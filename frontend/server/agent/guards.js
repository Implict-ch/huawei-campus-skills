/** 规范化短句：去标点空白，便于匹配寒暄/过渡语 */
export function normalizeShortUtterance(question) {
  return String(question || "")
    .trim()
    .replace(/[!！。.?？,，、~\s]/g, "")
    .replace(/(谢谢|多谢|感谢|啦|呀|呢|哈|啊|哦|噢|喔|呗|吧)+$/u, "");
}

/** 寒暄 / 自我介绍类：正常欢迎回复，不走离题/弱检索拒答 */
export function isMetaGreeting(question) {
  const q = normalizeShortUtterance(question);
  if (!q || q.length > 24) return false;
  return /^(你好|您好|嗨|哈喽|hello|hi|hey|你是谁|您是谁|你是什么|你叫什么|你是谁啊|介绍一下你自己|你能干什么|你能做什么|你可以做什么|你会做什么|你是做什么的|你有什么功能)$/i.test(
    q
  );
}

/**
 * 多轮对话中的过渡确认语（好的/明白/收到…）
 * 不应走弱检索拒答；有历史时交给模型承接上下文
 */
export function isConversationalAck(question) {
  const q = normalizeShortUtterance(question);
  if (!q || q.length > 16) return false;
  return /^(好的|好|好哒|好啊|好的呢|行|行的|可以|没问题|明白|明白了|懂了|了解|了解了|知道了|清楚了|收到|嗯|嗯嗯|唔|哦|噢|喔|ok|okay|yes|yeah|yep|是的|对|对的|继续|接着说|然后呢|还有吗|再说说|详细说说|展开讲讲)$/i.test(
    q
  );
}

export function filterHistoryMessages(history) {
  return Array.isArray(history)
    ? history.filter(
        (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
      )
    : [];
}

/** 历史里是否已有实质性用户问题（排除寒暄/过渡语） */
export function historyHasSubstance(history) {
  return filterHistoryMessages(history).some((m) => {
    if (m.role !== "user") return false;
    const t = String(m.content || "").trim();
    if (t.length < 8) return false;
    if (isMetaGreeting(t) || isConversationalAck(t)) return false;
    return true;
  });
}

/** 高置信度离题：其它公司、闲聊、纯理论等（含华为关键词则放行） */
export function isLikelyOffTopic(question) {
  const q = String(question || "").trim();
  if (!q) return false;
  if (isMetaGreeting(q) || isConversationalAck(q)) return false;

  const hasHuaweiScope =
    /华为|huawei|海思|荣耀终端|校招|机考|hwmj|lchot100|codefun|代码fun|塔子哥|面经|手撕|测评|od\b|offer|入池|保温|部门面|主管面/i.test(
      q
    );
  if (hasHuaweiScope) return false;

  if (
    /天气|气温|下雨|下雪|吃饭|吃什么|午饭|晚饭|笑话|写诗|翻译成|今日运势|股票|比特币|星座|恋爱|游戏推荐/i.test(q)
  ) {
    return true;
  }

  if (
    /字节|抖音|阿里|淘宝|腾讯|美团|拼多多|京东|百度|网易|快手|小红书招聘|微软|google|谷歌|meta|amazon|亚马逊|苹果招聘|oppo|vivo|小米校招|蚂蚁|网易游戏|shein|bilibili校招/i.test(
      q
    )
  ) {
    return true;
  }

  const theoryTopic =
    /双指针|动态规划|二叉树|链表|红黑树|哈希表|堆排序|快排|归并|操作系统|计算机网络|tcp|http|三次握手|进程|线程|死锁|虚拟内存/i.test(
      q
    );
  const asksTheory =
    /思想是什么|是什么意思|原理是什么|怎么理解|解释一下|介绍一下|讲讲|说说|^什么是/i.test(q);
  if (
    theoryTopic &&
    asksTheory &&
    !/面试|笔试|机考|手撕|面经|校招|求职|备考|会不会考|常考|华为/i.test(q)
  ) {
    return true;
  }

  return false;
}
