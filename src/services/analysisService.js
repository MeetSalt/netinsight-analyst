const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const File = require('../models/File');
const Analysis = require('../models/Analysis');
const { logger } = require('../utils/logger');

// 分析队列管理
class AnalysisQueue {
  constructor() {
    this.queue = [];
    this.running = new Map();
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_ANALYSIS) || 3;
  }
  
  add(fileId) {
    this.queue.push(fileId);
    this.process();
  }
  
  async process() {
    if (this.running.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }
    
    const fileId = this.queue.shift();
    this.running.set(fileId, new Date());
    
    try {
      await this.analyzeFile(fileId);
    } catch (error) {
      logger.error(`分析失败 ${fileId}:`, error);
    } finally {
      this.running.delete(fileId);
      // 继续处理队列中的下一个任务
      setImmediate(() => this.process());
    }
  }
  
  async analyzeFile(fileId) {
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error(`文件不存在: ${fileId}`);
    }
    
    logger.info(`开始分析文件: ${file.originalName} (${fileId})`);
    
    // 创建分析记录
    const analysis = new Analysis({
      fileId: fileId,
      status: 'running',
      config: {
        analysisType: 'basic',
        options: {
          includePayload: false,
          detectAnomalies: true,
          performanceAnalysis: true
        }
      }
    });
    
    await analysis.save();
    
    // 更新文件状态
    await file.updateAnalysisStatus('running');
    file.analysisId = analysis._id;
    await file.save();
    
    try {
      // 执行分析
      const results = await this.runAnalysis(file, analysis.config);
      
      // 保存分析结果
      analysis.results = results;
      await analysis.updateStatus('completed');
      
      // 更新文件状态
      await file.updateAnalysisStatus('completed');
      file.metadata = {
        ...file.metadata,
        ...results.summary
      };
      await file.save();
      
      logger.info(`分析完成: ${fileId}`);
      
    } catch (error) {
      logger.error(`分析过程出错 ${fileId}:`, error);
      
      // 保存错误信息
      await analysis.updateStatus('failed', {
        code: 'ANALYSIS_ERROR',
        message: error.message,
        details: error.stack
      });
      
      await file.updateAnalysisStatus('failed', error.message);
    }
  }
  
  async runAnalysis(file, config) {
    // 检查Python和scapy是否可用
    const pythonAvailable = await this.checkPythonEnvironment();
    
    if (!pythonAvailable) {
      logger.warn('Python环境不可用，使用模拟分析结果');
      return this.getMockAnalysisResults(file);
    }
    
    const pythonScript = this.getPythonScript(file.fileType);
    const scriptPath = path.join(__dirname, '../../analysis-scripts', pythonScript);
    
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`分析脚本不存在: ${scriptPath}`);
    }
    
    return new Promise((resolve, reject) => {
      const args = [
        scriptPath,
        file.filePath,
        JSON.stringify(config)
      ];
      
      logger.info(`执行Python分析: python3 ${args.join(' ')}`);
      
      const python = spawn('python3', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: parseInt(process.env.ANALYSIS_TIMEOUT) || 300000 // 5分钟超时
      });
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const results = JSON.parse(stdout);
            resolve(results);
          } catch (error) {
            reject(new Error(`解析分析结果失败: ${error.message}`));
          }
        } else {
          reject(new Error(`Python脚本执行失败 (exit code: ${code}): ${stderr}`));
        }
      });
      
      python.on('error', (error) => {
        reject(new Error(`启动Python脚本失败: ${error.message}`));
      });
    });
  }
  
  async checkPythonEnvironment() {
    return new Promise((resolve) => {
      const python = spawn('python3', ['-c', 'import scapy; print("OK")'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      });
      
      python.on('close', (code) => {
        resolve(code === 0);
      });
      
      python.on('error', () => {
        resolve(false);
      });
    });
  }
  
  getMockAnalysisResults(file) {
    // 根据文件类型返回模拟分析结果
    const fileStats = fs.statSync(file.filePath);
    
    if (file.fileType === 'har') {
      return {
        summary: {
          totalRequests: 145,
          totalBytes: fileStats.size,
          duration: 45.2,
          avgRequestSize: Math.floor(fileStats.size / 145),
          requestsPerSecond: 3.2
        },
        protocols: [
          { name: "HTTPS", requests: 120, percentage: 82.8 },
          { name: "HTTP", requests: 25, percentage: 17.2 }
        ],
        domains: [
          { domain: "api.example.com", requests: 45, totalBytes: Math.floor(fileStats.size * 0.3) },
          { domain: "cdn.example.com", requests: 38, totalBytes: Math.floor(fileStats.size * 0.4) }
        ],
        methods: [
          { method: "GET", requests: 98, percentage: 67.6 },
          { method: "POST", requests: 35, percentage: 24.1 },
          { method: "PUT", requests: 12, percentage: 8.3 }
        ],
        performance: {
          avgResponseTime: 245.6,
          maxResponseTime: 1234.5,
          minResponseTime: 23.4,
          avgResponseSize: Math.floor(fileStats.size / 145)
        },
        anomalies: [
          {
            type: "slow_requests",
            severity: "medium",
            description: "发现 3 个慢请求",
            details: { slowRequestCount: 3 }
          }
        ]
      };
    } else {
      // PCAP/CAP/PCAPNG 模拟结果
      return {
        summary: {
          totalPackets: 1547,
          totalBytes: fileStats.size,
          duration: 120.5,
          avgPacketSize: Math.floor(fileStats.size / 1547),
          packetsPerSecond: 12.8
        },
        protocols: [
          { name: "TCP", packets: 1200, percentage: 77.6 },
          { name: "UDP", packets: 300, percentage: 19.4 },
          { name: "ICMP", packets: 47, percentage: 3.0 }
        ],
        network: {
          topSources: [
            { ip: "192.168.1.100", packets: 456 },
            { ip: "192.168.1.105", packets: 234 },
            { ip: "10.0.0.15", packets: 189 }
          ],
          topDestinations: [
            { ip: "8.8.8.8", packets: 245 },
            { ip: "1.1.1.1", packets: 178 },
            { ip: "192.168.1.1", packets: 156 }
          ]
        },
        transport: {
          tcpPackets: 1200,
          udpPackets: 300,
          icmpPackets: 47,
          topPorts: [
            { port: 443, packets: 567 },
            { port: 80, packets: 345 },
            { port: 53, packets: 234 },
            { port: 22, packets: 89 }
          ]
        },
        connections: {
          totalConnections: 87,
          topConnections: [
            { connection: "192.168.1.100:45678->8.8.8.8:53", packets: 45 },
            { connection: "192.168.1.100:443->1.1.1.1:443", packets: 234 }
          ]
        },
        anomalies: [
          {
            type: "demo_analysis",
            severity: "info",
            description: "这是演示模式的分析结果，实际环境需要Python+scapy"
          }
        ]
      };
    }
  }
  
  getPythonScript(fileType) {
    const scripts = {
      'pcap': 'analyze_pcap.py',
      'cap': 'analyze_pcap.py',
      'pcapng': 'analyze_pcap.py',
      'har': 'analyze_har.py'
    };
    
    return scripts[fileType] || 'analyze_pcap.py';
  }
  
  getQueueStatus() {
    return {
      waiting: this.queue.length,
      running: this.running.size,
      maxConcurrent: this.maxConcurrent,
      runningTasks: Array.from(this.running.entries()).map(([fileId, startTime]) => ({
        fileId,
        startTime,
        duration: Date.now() - startTime
      }))
    };
  }
}

// 创建全局分析队列实例
const analysisQueue = new AnalysisQueue();

/**
 * 启动文件分析
 * @param {string} fileId 文件ID
 */
const startAnalysis = async (fileId) => {
  logger.info(`添加分析任务到队列: ${fileId}`);
  analysisQueue.add(fileId);
};

/**
 * 获取分析队列状态
 */
const getQueueStatus = () => {
  return analysisQueue.getQueueStatus();
};

/**
 * 重新分析文件
 * @param {string} fileId 文件ID
 */
const reAnalyze = async (fileId) => {
  const file = await File.findById(fileId);
  if (!file) {
    throw new Error('文件不存在');
  }
  
  // 重置分析状态
  await file.updateAnalysisStatus('pending');
  
  // 删除旧的分析记录
  if (file.analysisId) {
    await Analysis.findByIdAndDelete(file.analysisId);
    file.analysisId = null;
    await file.save();
  }
  
  // 重新添加到队列
  startAnalysis(fileId);
};

/**
 * 取消分析任务
 * @param {string} fileId 文件ID
 */
const cancelAnalysis = async (fileId) => {
  // 从队列中移除
  const index = analysisQueue.queue.indexOf(fileId);
  if (index > -1) {
    analysisQueue.queue.splice(index, 1);
    logger.info(`从队列中取消分析任务: ${fileId}`);
    return true;
  }
  
  // 如果正在运行，标记为取消（实际的进程取消需要更复杂的实现）
  if (analysisQueue.running.has(fileId)) {
    logger.warn(`分析任务正在运行中，无法取消: ${fileId}`);
    return false;
  }
  
  return false;
};

module.exports = {
  startAnalysis,
  reAnalyze,
  cancelAnalysis,
  getQueueStatus
}; 