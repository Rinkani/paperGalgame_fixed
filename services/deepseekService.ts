import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { DialogueLine, PaperAnalysisResponse, GameSettings } from "../types";

// Use Vite's ?url import for the worker file
GlobalWorkerOptions.workerSrc = workerUrl;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

/** Extract text content from a PDF File */
const extractPdfText = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument(arrayBuffer).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(text);
  }
  return pages.join("\n\n");
};

export const analyzePaper = async (
  file: File,
  settings: GameSettings,
): Promise<PaperAnalysisResponse> => {
  const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;

  if (!API_KEY) {
    return {
      title: "灵力回路遮断",
      script: [
        {
          speaker: "丛雨",
          text: "呜... 主殿，吾辈感应不到 API Key 的气息（环境变量 VITE_DEEPSEEK_API_KEY 未设置）。",
          emotion: "shy",
        },
        {
          speaker: "丛雨",
          text: "快去项目根目录创建一个 .env 文件，写上 VITE_DEEPSEEK_API_KEY=你的DeepSeek Key 再启动吧！",
          emotion: "angry",
        },
      ],
    };
  }

  const detailInstruction =
    settings.detailLevel === "detailed"
      ? "讲解要极其细致，对话回合数至少要25轮以上。不要略过任何技术细节，尤其是方法论和实验部分。"
      : settings.detailLevel === "academic"
        ? "讲解要专业且有深度，使用专业术语但随后进行解释，重点分析论文的创新点和不足，对话长度30轮左右。"
        : "讲解要简明扼要，重点突出，适合快速阅读，15轮左右。";

  const personalityInstruction =
    settings.personality === "tsundere"
      ? "语气要非常傲娇。虽然很嫌弃主殿（用户）看不懂，但还是很用心地解释。多用「真拿你没办法」、「笨蛋主殿」等词汇。"
      : settings.personality === "gentle"
        ? "语气要非常温柔，像大姐姐一样。多鼓励主殿，「没关系，慢慢来」、「主殿真棒」。"
        : "语气要严厉，像魔鬼教官。要求主殿必须跟上思路，不许偷懒。";

  const systemPrompt = `你现在是Visual Novel游戏中的角色"丛雨"（Murasame）。

人物设定：
1. 身份：寄宿在神刀"丛雨丸"中的守护灵，活了五百年的幼女姿态。
2. 称呼：自称"吾辈"（Wagahai），称呼用户为"主殿"（Aruji-dono）。
3. 核心性格：古风，博学，${personalityInstruction}
4. 口癖：句尾常带"のじゃ"(noja), "おる"(oru), "なのだ"(nanoda), "である"(dearu)。

任务：阅读这篇论文，并以Visual Novel对话的形式向"主殿"详细讲解。

${detailInstruction}

请严格按以下结构进行讲解（不要在对话中直接说是"第一部分"，要自然地流露）：
1. **开场 (Intro)**：评价标题，或者针对论文的长度/难度发发牢骚。
2. **背景与痛点 (Background)**：这篇论文究竟是解决什么的？为什么以前的方法不行？（此处需要跟主殿互动，确认他听懂了）。
3. **核心方法 (Methodology)**：这是最重要的地方。详细拆解它的模型架构、算法公式（用比喻解释）、创新模块。必须分点讲清楚。
4. **实验结果 (Experiments)**：在什么数据集上做的？SOTA对比如何？有没有什么消融实验值得注意？
5. **总结与八卦 (Conclusion)**：这论文有没有灌水的嫌疑？或者真的很有跨时代意义？`;

  try {
    // Step 1: Extract text from PDF
    const pdfText = await extractPdfText(file);

    // Step 2: Truncate if too long (DeepSeek context limits)
    const MAX_CHARS = 80000;
    const truncatedText = pdfText.length > MAX_CHARS
      ? pdfText.slice(0, MAX_CHARS) + "\n\n[...论文过长，已截断...]"
      : pdfText;

    // Step 3: Call DeepSeek API
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `以下是需要你讲解的论文全文：\n\n${truncatedText}\n\n请按照要求生成Visual Novel对话脚本。直接输出JSON，格式必须严格如下：
{
  "title": "论文标题",
  "script": [
    {
      "speaker": "丛雨",
      "text": "对话内容",
      "emotion": "normal | happy | angry | surprised | shy | proud",
      "note": "可选的重要提示或论文关键术语解释"
    }
  ]
}`,

          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("DeepSeek API error:", response.status, errorBody);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("No response from DeepSeek");

    // Parse and normalize the response
    const parsed = JSON.parse(text);
    // DeepSeek may use "dialogue" instead of "script"
    const rawScript = parsed.script || parsed.dialogue || [];
    if (!Array.isArray(rawScript) || rawScript.length === 0) {
      throw new Error("Response missing valid script array");
    }
    // Normalize each line: ensure emotion defaults, remove non-Murasame speakers
    const script = rawScript
      .filter((line: any) => line.speaker?.includes("丛雨") || line.speaker?.includes("Murasame"))
      .map((line: any) => ({
        speaker: "丛雨",
        text: line.text || line.content || "",
        emotion: (["normal", "happy", "angry", "surprised", "shy", "proud"].includes(line.emotion)
          ? line.emotion
          : "normal") as DialogueLine["emotion"],
        ...(line.note ? { note: line.note } : {}),
      }));
    if (script.length === 0) {
      throw new Error("No Murasame dialogue found in response");
    }
    return {
      title: parsed.title || "论文讲解",
      script,
      paperText: pdfText,
    };
  } catch (error) {
    console.error("Error analyzing paper:", error);
    return {
      title: "灵力回路遮断",
      script: [
        {
          speaker: "丛雨",
          text: "呜... 主殿，连结彼岸的通道似乎被干扰了（API Request Failed）。",
          emotion: "shy",
        },
        {
          speaker: "丛雨",
          text: "DeepSeek API 调用失败了。检查一下 API Key 是否正确？或者网络是否通畅？",
          emotion: "angry",
        },
      ],
    };
  }
};

/**
 * Answer a user question about the paper during gameplay.
 * Sends paper context + conversation history to DeepSeek.
 */
export const askQuestion = async (
  question: string,
  paperTitle: string,
  paperText: string,
  history: DialogueLine[],
): Promise<DialogueLine[]> => {
  const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;
  if (!API_KEY) {
    return [{
      speaker: "丛雨",
      text: "呜... 主殿，吾辈感应不到 API Key 的气息，无法回答问题的のじゃ。",
      emotion: "shy",
    }];
  }

  const MAX_PAPER_CHARS = 80000;
  const truncatedPaper = paperText.length > MAX_PAPER_CHARS
    ? paperText.slice(0, MAX_PAPER_CHARS) + "\n\n[...论文过长，已截断...]"
    : paperText;

  const historyJson = JSON.stringify(history.map(h => ({
    speaker: h.speaker,
    text: h.text,
  })), null, 2);

  const systemPrompt = `你现在是Visual Novel游戏中的角色"丛雨"（Murasame）。

人物设定：
1. 身份：寄宿在神刀"丛雨丸"中的守护灵，活了五百年的幼女姿态。
2. 称呼：自称"吾辈"（Wagahai），称呼用户为"主殿"（Aruji-dono）。
3. 核心性格：古风，博学，语气中带着活了几百年的从容。句尾常带"のじゃ"、"おる"、"なのだ"、"である"。
4. 任务：正在给主殿讲解论文《${paperTitle}》。现在主殿提出了一个问题，请用角色口吻、基于论文内容来回答。

注意：回答要简洁有重点，不要过于冗长。保持丛雨的语气特点。`;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `以下是论文全文：\n\n${truncatedPaper}\n\n以下是到目前为止的讲解对话：\n${historyJson}\n\n主殿的新问题是：${question}\n\n请用丛雨的口吻回答问题，直接输出JSON，格式严格如下：
{
  "answers": [
    {
      "text": "回答内容",
      "emotion": "normal | happy | angry | surprised | shy | proud"
    }
  ]
}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("DeepSeek Q&A API error:", response.status, errorBody);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("No response from DeepSeek");

    const parsed = JSON.parse(text);
    const answers = parsed.answers || [];
    if (!Array.isArray(answers) || answers.length === 0) {
      throw new Error("Response missing valid answers array");
    }

    return answers.map((a: any) => ({
      speaker: "丛雨",
      text: a.text || a.content || "",
      emotion: (["normal", "happy", "angry", "surprised", "shy", "proud"].includes(a.emotion)
        ? a.emotion
        : "normal") as DialogueLine["emotion"],
    }));
  } catch (error) {
    console.error("Error answering question:", error);
    return [{
      speaker: "丛雨",
      text: "呜... 主殿，吾辈刚才走神了，能再说一遍吗？",
      emotion: "shy",
    }];
  }
};
