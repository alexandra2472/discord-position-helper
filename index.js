require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// 创建客户端（slash 指令只需要 Guilds 这个 intent）
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// 统一的仓位计算函数
function calcPosition(sideRaw, entry, sl, balance, riskPct) {
  const side = sideRaw === 'long' ? '多单 🟢' : '空单 🔴';

  let distance;
  if (sideRaw === 'long') {
    distance = entry - sl;
  } else {
    distance = sl - entry;
  }

  if (distance <= 0) {
    return {
      error:
        sideRaw === 'long'
          ? '多单止损价必须低于进场价（例如 entry=3000, sl=2900）。'
          : '空单止损价必须高于进场价（例如 entry=3000, sl=3100）。'
    };
  }

  const riskAmount = balance * (riskPct / 100);
  const qty = riskAmount / distance;
  const notional = qty * entry;

  const f2 = (x) => x.toFixed(2);

  const text = [
    `方向：${side}`,
    `进场价：${f2(entry)}`,
    `止损价：${f2(sl)}`,
    `账户金额：${f2(balance)} USDT`,
    `单笔风险：${f2(riskPct)}% → ${f2(riskAmount)} USDT`,
    ``,
    `价格距离：${f2(distance)}`,
    `建议持仓数量：${f2(qty)}`,
    `名义仓位约：${f2(notional)} USDT`,
    ``,
    `提示：这单就算打到止损，亏损也控制在账户的 ${f2(riskPct)}%。` +
      ` 真正的难点不是算数，而是——进场后别乱加仓、别乱挪止损。`
  ].join('\n');

  return { text };
}

// 针对你这类中文提醒格式的解析函数
// 示例：
// 🔴 方向：空单（SHORT）
// · 入场价：1951.56
// · 止损价：2000.35（+2.50%）
function parseAlertFromCn(content) {
  // 方向：空单（SHORT） / 方向：多单（LONG）
  const sideMatch = content.match(/方向[:：]\s*(多单|空单)/);
  let sideRaw = null;
  if (sideMatch) {
    const sideCn = sideMatch[1];
    sideRaw = sideCn === '多单' ? 'long' : 'short';
  }

  // 入场价：1951.56
  const entryMatch = content.match(/入场价[:：]\s*([0-9.]+)/);
  const slMatch = content.match(/止损价[:：]\s*([0-9.]+)/);

  if (!sideRaw || !entryMatch || !slMatch) {
    return null;
  }

  const entry = parseFloat(entryMatch[1]);
  const sl = parseFloat(slMatch[1]);

  if (isNaN(entry) || isNaN(sl)) {
    return null;
  }

  return { sideRaw, entry, sl };
}

// 机器人上线提示
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// 处理 slash 指令
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // /pos 手动输入版
  if (interaction.commandName === 'pos') {
    const sideRaw = interaction.options.getString('side');          // long / short
    const entry = interaction.options.getNumber('entry_price');     // 进场价
    const sl = interaction.options.getNumber('sl_price');           // 止损价
    const balance = interaction.options.getNumber('balance');       // 账户金额
    const riskPct = interaction.options.getNumber('risk_pct');      // 风险%

    if (!['long', 'short'].includes(sideRaw)) {
      await interaction.reply({
        content: '方向必须是 long 或 short。',
        ephemeral: true
      });
      return;
    }

    if ([entry, sl, balance, riskPct].some(v => typeof v !== 'number' || v <= 0)) {
      await interaction.reply({
        content: '进场价、止损价、账户金额和风险百分比都必须是大于 0 的数字。',
        ephemeral: true
      });
      return;
    }

    const result = calcPosition(sideRaw, entry, sl, balance, riskPct);
    if (result.error) {
      await interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    } else {
      await interaction.reply({ content: result.text, ephemeral: true });
    }
  }

  // /pos_alert 从提醒文本自动解析版
  if (interaction.commandName === 'pos_alert') {
    const alertText = interaction.options.getString('alert_text');
    const balance = interaction.options.getNumber('balance');
    const riskPct = interaction.options.getNumber('risk_pct');

    if (typeof balance !== 'number' || balance <= 0 || typeof riskPct !== 'number' || riskPct <= 0) {
      await interaction.reply({
        content: '账户金额和风险百分比必须是大于 0 的数字。',
        ephemeral: true
      });
      return;
    }

    const parsed = parseAlertFromCn(alertText || '');
    if (!parsed) {
      await interaction.reply({
        content:
          '❌ 无法从这段文本中读出方向 / 入场价 / 止损价。\n' +
          '请确认文本中包含类似：\n' +
          '「方向：空单」/「方向：多单」\n' +
          '「入场价：1951.56」\n' +
          '「止损价：2000.35」',
        ephemeral: true
      });
      return;
    }

    const { sideRaw, entry, sl } = parsed;
    const result = calcPosition(sideRaw, entry, sl, balance, riskPct);

    if (result.error) {
      await interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    } else {
      await interaction.reply({
        content:
          '（已从你粘贴的策略提醒中自动读取方向 / 入场价 / 止损价）\n\n' +
          result.text,
        ephemeral: true
      });
    }
  }
});

// 登录
client.login(process.env.BOT_TOKEN);