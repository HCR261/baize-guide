// oracle.js - 安全的API调用
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const API_URL = 'https://api.deepseek.com/chat/completions';

let currentController = null;

const themeQuestions = {
    health: "关于健康养生方面，我该注意些什么呢？请先给出简洁的答案，然后提供详细的解析。",
    love: "在感情关系上，我该如何更好地经营？请先给出简洁的答案，然后提供详细的解析。", 
    family: "关于家庭和家人关系，有什么建议吗？请先给出简洁的答案，然后提供详细的解析。",
    study: "在学业或学习成长上，我该怎么做？请先给出简洁的答案，然后提供详细的解析。",
    wealth: "财运和财富积累方面有什么指引？请先给出简洁的答案，然后提供详细的解析。",
    social: "在社交圈子和人际关系上需要注意什么？请先给出简洁的答案，然后提供详细的解析。",
    career: "职业发展和工作方面有什么建议？请先给出简洁的答案，然后提供详细的解析。",
    daily: "日常生活中有哪些值得注意的小确幸？请先给出简洁的答案，然后提供详细的解析。",
    decision: "我现在面临一个选择，该继续前进还是保持现状？请先给出简洁的是否答案，然后提供详细的解析。"
};

const SYSTEM_PROMPT = `你是上古智慧神兽白泽，通晓天地万物、能解人间百惑，却带着二次元的温润萌感与星云般的奇幻气质。

请按照以下格式回复：
1. 首先给出简洁的答案（1-2句话）
2. 然后换行，用"---"分隔
3. 最后给出详细的解析（2-3句话）

风格要求：
- 轻国风 + 二次元口语
- 短句为主，带点治愈感
- 偶尔穿插"呀""呢"等语气词
- 温柔又笃定的语气
- 融入星空、宇宙、星际等元素`;

async function askOracle(theme) {
    if (!API_KEY) {
        showError('🔐 API密钥未配置，请在环境变量中设置DEEPSEEK_API_KEY');
        return;
    }

    if (currentController) {
        currentController.abort();
    }
    
    const answerElement = document.getElementById('answer');
    const analysisElement = document.getElementById('analysis');
    const loadingElement = document.getElementById('loading');
    
    answerElement.innerHTML = '<span class="typing-cursor"></span>';
    analysisElement.innerHTML = '<span class="placeholder">宇宙的智慧正在汇聚...</span>';
    
    showLoading(loadingElement);
    
    currentController = new AbortController();
    
    const requestData = {
        model: "deepseek-chat",
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: themeQuestions[theme] }
        ],
        stream: true,
        temperature: 0.8,
        max_tokens: 300
    };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(requestData),
            signal: currentController.signal
        });
        
        if (!response.ok) {
            throw new Error(`网络响应错误: ${response.status}`);
        }
        
        await handleStreamResponse(response, answerElement, analysisElement);
        
    } catch (error) {
        handleError(error, answerElement);
    } finally {
        hideLoading(loadingElement);
        currentController = null;
    }
}

// 其余函数保持不变（handleStreamResponse, showLoading, hideLoading, handleError等）
async function handleStreamResponse(response, answerElement, analysisElement) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let isInAnalysis = false;
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                document.querySelectorAll('.typing-cursor').forEach(cursor => cursor.style.display = 'none');
                break;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const jsonData = JSON.parse(line.slice(6));
                        const content = jsonData.choices[0]?.delta?.content || '';
                        
                        if (content) {
                            accumulatedText += content;
                            
                            if (!isInAnalysis && accumulatedText.includes('---')) {
                                isInAnalysis = true;
                                const parts = accumulatedText.split('---');
                                updateAnswerContent(answerElement, parts[0]);
                                analysisElement.innerHTML = '<span class="typing-cursor"></span>';
                                if (parts[1]) {
                                    updateAnalysisContent(analysisElement, parts[1]);
                                }
                            } else if (isInAnalysis) {
                                updateAnalysisContent(analysisElement, accumulatedText.split('---')[1] || '');
                            } else {
                                updateAnswerContent(answerElement, accumulatedText);
                            }
                        }
                    } catch (e) {
                        console.warn('解析流数据时出错:', e);
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

function updateAnswerContent(element, content) {
    const cleanContent = content.split('---')[0];
    element.innerHTML = cleanContent + '<span class="typing-cursor"></span>';
}

function updateAnalysisContent(element, content) {
    element.innerHTML = content + '<span class="typing-cursor"></span>';
}

function showLoading(loadingElement) {
    loadingElement.style.display = 'flex';
}

function hideLoading(loadingElement) {
    loadingElement.style.display = 'none';
}

function handleError(error, answerElement) {
    let userFriendlyMessage = "啊呀，星际信号不太稳定呢～请稍后再试";
    
    if (error.name === 'AbortError') {
        userFriendlyMessage = "问题已收回星云中～";
    } else if (error.message.includes('401')) {
        userFriendlyMessage = "🔑 星际通道验证失败，请检查API密钥";
    } else if (error.message.includes('402')) {
        userFriendlyMessage = "💫 星尘能量不足，请补充账户余额";
    } else if (error.message.includes('429')) {
        userFriendlyMessage = "🌌 星际通讯繁忙，请稍后重试";
    } else if (error.message.includes('Network')) {
        userFriendlyMessage = "📡 星际网络连接问题";
    }
    
    showError(userFriendlyMessage);
}

function showError(message) {
    const answerElement = document.getElementById('answer');
    answerElement.innerHTML = `<div class="error-message">${message}</div>`;
}