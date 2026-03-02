require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  // /pos 手动输入版
  new SlashCommandBuilder()
    .setName('pos')
    .setDescription('根据方向、价格和账户金额计算建议仓位')
    .addStringOption(option =>
      option
        .setName('side')
        .setDescription('多单 or 空单')
        .setRequired(true)
        .addChoices(
          { name: '多单（long）', value: 'long' },
          { name: '空单（short）', value: 'short' }
        )
    )
    .addNumberOption(option =>
      option
        .setName('entry_price')
        .setDescription('进场价')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('sl_price')
        .setDescription('止损价')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('balance')
        .setDescription('账户总金额（USDT）')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('risk_pct')
        .setDescription('单笔风险百分比，例如 2 代表 2%')
        .setRequired(true)
    ),

  // /pos_alert 从提醒文本解析版
  new SlashCommandBuilder()
    .setName('pos_alert')
    .setDescription('从一条策略提醒文本里自动读取方向/入场/止损并计算仓位')
    .addStringOption(option =>
      option
        .setName('alert_text')
        .setDescription('粘贴策略提醒的完整文本')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('balance')
        .setDescription('账户总金额（USDT）')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('risk_pct')
        .setDescription('单笔风险百分比，例如 2 代表 2%')
        .setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log('开始注册应用指令（slash commands）...');

    const GUILD_ID = '1475274245381558324'; // 这里替换成刚才复制的服务器ID

    await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
        { body: commands }
    );

    console.log('✅ 指令注册完成。');
  } catch (error) {
    console.error('❌ 注册指令失败：', error);
  }
})();