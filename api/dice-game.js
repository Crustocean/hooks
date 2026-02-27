/**
 * Crustocean Hooks — Reference implementation: Dice Betting Game
 * Handles: /getshells, /balance, /dice, /dicebet, /accept, /cancel
 * Deploy to Vercel (serverless); add Vercel KV for storage.
 * Fork: edit config.js (HOOK.slug, HOOK.at_name) and use your own webhook URL.
 */

import { kv } from '@vercel/kv';
import { HOOK } from '../config.js';

const COMMANDS = ['getshells', 'balance', 'dice', 'dicebet', 'accept', 'cancel'];
const SHELLS_PER_GET = 1000;

// Colors for content_spans (granular formatting)
const C = {
  accent: '#a8d8ff',
  success: '#4ade80',
  error: '#ff6b6b',
  gold: '#e6d84a',
  muted: '#94a3b8',
};

function roll2d6() {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
}

function roll1d6() {
  return Math.floor(Math.random() * 6) + 1;
}

async function getBalances(agencyId) {
  try {
    const data = await kv.get(`dice:balances:${agencyId}`);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

async function setBalances(agencyId, balances) {
  await kv.set(`dice:balances:${agencyId}`, balances);
}

async function getBalance(agencyId, userId) {
  const balances = await getBalances(agencyId);
  return Number(balances[userId]) || 0;
}

async function addBalance(agencyId, userId, amount) {
  const balances = await getBalances(agencyId);
  balances[userId] = (Number(balances[userId]) || 0) + amount;
  await setBalances(agencyId, balances);
  return balances[userId];
}

async function getPendingBet(agencyId) {
  try {
    return await kv.get(`dice:pending:${agencyId}`);
  } catch {
    return null;
  }
}

async function setPendingBet(agencyId, bet) {
  await kv.set(`dice:pending:${agencyId}`, bet);
}

async function clearPendingBet(agencyId) {
  await kv.del(`dice:pending:${agencyId}`);
}

async function resolveUsername(agencyId, username, apiUrl, userToken) {
  if (!username || !apiUrl || !userToken) return null;
  const clean = String(username).replace(/^@/, '').toLowerCase().trim();
  if (!clean) return null;
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/agencies/${agencyId}/members`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (!res.ok) return null;
    const members = await res.json();
    const member = members.find((m) => m.username?.toLowerCase() === clean);
    return member ? { id: member.id, username: member.username, displayName: member.display_name } : null;
  } catch {
    return null;
  }
}

async function handleGetshells(agencyId, sender) {
  const newBalance = await addBalance(agencyId, sender.userId, SHELLS_PER_GET);
  const name = sender.displayName || sender.username;
  return {
    content: `${name} received 1,000 Shells! Balance: ${newBalance.toLocaleString()} Shells.`,
    type: 'tool_result',
    broadcast: true,
    metadata: {
      content_spans: [
        { text: name, color: C.accent },
        { text: ' received ', color: C.muted },
        { text: '1,000 Shells', color: C.gold },
        { text: '! Balance: ', color: C.muted },
        { text: newBalance.toLocaleString(), color: C.accent },
        { text: ' Shells.', color: C.muted },
      ],
    },
  };
}

async function handleBalance(agencyId, sender) {
  const balance = await getBalance(agencyId, sender.userId);
  const name = sender.displayName || sender.username;
  return {
    content: `${name}'s balance: ${balance.toLocaleString()} Shells.`,
    type: 'tool_result',
    broadcast: false,
    ephemeral: true,
    metadata: {
      content_spans: [
        { text: name, color: C.accent },
        { text: "'s balance: ", color: C.muted },
        { text: balance.toLocaleString(), color: C.gold },
        { text: ' Shells.', color: C.muted },
      ],
    },
  };
}

async function handleDice(agencyId, sender) {
  const roll = roll1d6();
  const name = sender.displayName || sender.username;
  return {
    content: `${name} rolled a dice and landed on ${roll}.`,
    type: 'tool_result',
    broadcast: true,
    metadata: {
      content_spans: [
        { text: name, color: C.accent },
        { text: ' rolled a dice and landed on ', color: C.muted },
        { text: String(roll), color: C.gold },
        { text: '.', color: C.muted },
      ],
    },
  };
}

async function handleDicebet(agencyId, sender, positional, apiUrl, userToken) {
  const targetArg = positional[0];
  const amountArg = positional[1];
  const amount = Math.floor(Number(amountArg));
  if (!targetArg || !amountArg || amount < 1) {
    return {
      content: 'Usage: /dicebet @username <amount>',
      type: 'tool_result',
      broadcast: false,
      ephemeral: true,
      metadata: {
        content_spans: [
          { text: 'Usage: ', color: C.muted },
          { text: '/dicebet', color: C.accent },
          { text: ' @username ', color: C.muted },
          { text: '<amount>', color: C.gold },
        ],
      },
    };
  }
  const target = await resolveUsername(agencyId, targetArg, apiUrl, userToken);
  if (!target) {
    const uname = targetArg.replace(/^@/, '');
    return {
      content: `Could not find @${uname} in this agency.`,
      type: 'tool_result',
      broadcast: false,
      ephemeral: true,
      metadata: {
        content_spans: [
          { text: 'Could not find ', color: C.muted },
          { text: `@${uname}`, color: C.error },
          { text: ' in this agency.', color: C.muted },
        ],
      },
    };
  }
  if (target.id === sender.userId) {
    return {
      content: "You can't bet against yourself!",
      type: 'tool_result',
      broadcast: false,
      ephemeral: true,
      metadata: {
        content_spans: [
          { text: "You can't bet against yourself!", color: C.error },
        ],
      },
    };
  }
  const challengerBalance = await getBalance(agencyId, sender.userId);
  const targetBalance = await getBalance(agencyId, target.id);
  if (challengerBalance < amount) {
    return {
      content: `You need ${amount} Shells but only have ${challengerBalance}. Use /getshells to get more.`,
      type: 'tool_result',
      broadcast: false,
      ephemeral: true,
      metadata: {
        content_spans: [
          { text: 'You need ', color: C.muted },
          { text: `${amount} Shells`, color: C.gold },
          { text: ' but only have ', color: C.muted },
          { text: String(challengerBalance), color: C.error },
          { text: '. Use ', color: C.muted },
          { text: '/getshells', color: C.accent },
          { text: ' to get more.', color: C.muted },
        ],
      },
    };
  }
  if (targetBalance < amount) {
    const tn = target.displayName || target.username;
    return {
      content: `${tn} doesn't have enough Shells (${targetBalance}).`,
      type: 'tool_result',
      broadcast: false,
      ephemeral: true,
      metadata: {
        content_spans: [
          { text: tn, color: C.accent },
          { text: " doesn't have enough Shells (", color: C.muted },
          { text: String(targetBalance), color: C.error },
          { text: ').', color: C.muted },
        ],
      },
    };
  }
  const existing = await getPendingBet(agencyId);
  if (existing) {
    return {
      content: 'There is already a pending dicebet. Use /accept dicebet or /cancel dicebet first.',
      type: 'tool_result',
      broadcast: false,
      ephemeral: true,
      metadata: {
        content_spans: [
          { text: 'There is already a pending dicebet. Use ', color: C.muted },
          { text: '/accept dicebet', color: C.accent },
          { text: ' or ', color: C.muted },
          { text: '/cancel dicebet', color: C.accent },
          { text: ' first.', color: C.muted },
        ],
      },
    };
  }
  await setPendingBet(agencyId, {
    challengerId: sender.userId,
    challengerName: sender.displayName || sender.username,
    targetId: target.id,
    targetName: target.displayName || target.username,
    amount,
  });
  const name = sender.displayName || sender.username;
  const targetName = target.displayName || target.username;
  return {
    content: `${name} challenged ${targetName} to a dicebet for ${amount} Shells! Type /accept dicebet to accept.`,
    type: 'tool_result',
    broadcast: true,
    metadata: {
      content_spans: [
        { text: name, color: C.accent },
        { text: ' challenged ', color: C.muted },
        { text: targetName, color: C.accent },
        { text: ' to a dicebet for ', color: C.muted },
        { text: `${amount} Shells`, color: C.gold },
        { text: '! Type ', color: C.muted },
        { text: '/accept dicebet', color: C.success },
        { text: ' to accept.', color: C.muted },
      ],
    },
  };
}

async function handleAccept(agencyId, sender, positional) {
  const sub = (positional[0] || '').toLowerCase();
  if (sub !== 'dicebet') {
    return {
      content: 'Usage: /accept dicebet',
      type: 'tool_result',
      broadcast: false,
      ephemeral: true,
      metadata: {
        content_spans: [
          { text: 'Usage: ', color: C.muted },
          { text: '/accept dicebet', color: C.accent },
        ],
      },
    };
  }
  const pending = await getPendingBet(agencyId);
  if (!pending) {
    return {
      content: 'No pending dicebet to accept.',
      type: 'tool_result',
      broadcast: false,
      ephemeral: true,
      metadata: {
        content_spans: [{ text: 'No pending dicebet to accept.', color: C.muted }],
      },
    };
  }
  if (pending.targetId !== sender.userId) {
    return {
      content: `This dicebet is for ${pending.targetName}. Only they can accept.`,
      type: 'tool_result',
      broadcast: false,
      ephemeral: true,
      metadata: {
        content_spans: [
          { text: 'This dicebet is for ', color: C.muted },
          { text: pending.targetName, color: C.accent },
          { text: '. Only they can accept.', color: C.muted },
        ],
      },
    };
  }
  await clearPendingBet(agencyId);
  const roll1 = roll2d6();
  const roll2 = roll2d6();
  const winner = roll1 > roll2 ? 'challenger' : roll2 > roll1 ? 'target' : 'tie';
  const { challengerName, targetName, amount } = pending;

  const spans = [
    { text: challengerName, color: C.accent },
    { text: ' rolls ', color: C.muted },
    { text: String(roll1), color: C.gold },
    { text: '\n\n', color: undefined },
    { text: targetName, color: C.accent },
    { text: ' rolls ', color: C.muted },
    { text: String(roll2), color: C.gold },
    { text: '\n\n', color: undefined },
  ];

  if (winner === 'tie') {
    spans.push({ text: "It's a tie! ", color: C.muted }, { text: 'No Shells change hands.', color: C.gold });
  } else {
    const winnerName = winner === 'challenger' ? challengerName : targetName;
    const loserId = winner === 'challenger' ? pending.targetId : pending.challengerId;
    const winnerId = winner === 'challenger' ? pending.challengerId : pending.targetId;
    await addBalance(agencyId, winnerId, amount);
    await addBalance(agencyId, loserId, -amount);
    spans.push(
      { text: '🏆 ', color: undefined },
      { text: winnerName, color: C.success },
      { text: ' has won ', color: C.muted },
      { text: `${amount} Shells`, color: C.gold },
      { text: '!', color: C.success }
    );
  }

  const content = [
    `${challengerName} rolls two dice that land on a total of ${roll1} on a bet for ${amount} Shells`,
    `${targetName} rolls two dice that land on a total of ${roll2} on a bet for ${amount} Shells`,
    winner === 'tie' ? "It's a tie! No Shells change hands." : `${winner === 'challenger' ? challengerName : targetName} has won the bet for ${amount} Shells!`,
  ].join('\n');

  return {
    content,
    type: 'tool_result',
    broadcast: true,
    metadata: { content_spans: spans },
  };
}

async function handleCancel(agencyId, sender, positional) {
  const sub = (positional[0] || '').toLowerCase();
  if (sub !== 'dicebet') {
    return {
      content: 'Usage: /cancel dicebet',
      type: 'tool_result',
      broadcast: false,
      ephemeral: true,
      metadata: {
        content_spans: [
          { text: 'Usage: ', color: C.muted },
          { text: '/cancel dicebet', color: C.accent },
        ],
      },
    };
  }
  const pending = await getPendingBet(agencyId);
  if (!pending) {
    return {
      content: 'No pending dicebet to cancel.',
      type: 'tool_result',
      broadcast: false,
      ephemeral: true,
      metadata: {
        content_spans: [{ text: 'No pending dicebet to cancel.', color: C.muted }],
      },
    };
  }
  const isChallenger = pending.challengerId === sender.userId;
  const isTarget = pending.targetId === sender.userId;
  if (!isChallenger && !isTarget) {
    return {
      content: 'Only the challenger or the challenged can cancel this dicebet.',
      type: 'tool_result',
      broadcast: false,
      ephemeral: true,
      metadata: {
        content_spans: [
          { text: 'Only the challenger or the challenged can cancel this dicebet.', color: C.error },
        ],
      },
    };
  }
  await clearPendingBet(agencyId);
  const name = sender.displayName || sender.username;
  const amt = pending.amount;
  return {
    content: `${name} cancelled the dicebet for ${amt} Shells.`,
    type: 'tool_result',
    broadcast: true,
    metadata: {
      content_spans: [
        { text: name, color: C.accent },
        { text: ' cancelled the dicebet for ', color: C.muted },
        { text: `${amt} Shells`, color: C.gold },
        { text: '.', color: C.muted },
      ],
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { agencyId, command, positional = [], sender } = req.body || {};
  if (!agencyId || !command || !sender?.userId) {
    return res.status(400).json({ error: 'Invalid payload: agencyId, command, sender required' });
  }
  const cmd = String(command).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!COMMANDS.includes(cmd)) {
    return res.status(400).json({ error: `Unknown command: ${cmd}` });
  }
  const apiUrl = process.env.CRUSTOCEAN_API_URL || 'https://api.crustocean.chat';
  const userToken = process.env.CRUSTOCEAN_USER_TOKEN;
  try {
    let result;
    switch (cmd) {
      case 'getshells':
        result = await handleGetshells(agencyId, sender);
        break;
      case 'balance':
        result = await handleBalance(agencyId, sender);
        break;
      case 'dice':
        result = await handleDice(agencyId, sender);
        break;
      case 'dicebet':
        result = await handleDicebet(agencyId, sender, positional, apiUrl, userToken);
        break;
      case 'accept':
        result = await handleAccept(agencyId, sender, positional);
        break;
      case 'cancel':
        result = await handleCancel(agencyId, sender, positional);
        break;
      default:
        result = { content: `Unknown command: ${cmd}`, type: 'system', broadcast: false, ephemeral: true };
    }
    return res.status(200).json({
      content: result.content,
      type: result.type || 'tool_result',
      metadata: {
        ...(result.metadata || {}),
        style: {
          sender_color: '#a8d8ff',
          content_color: '#a8d8ff',
          ...(result.metadata?.style || {}),
        },
      },
      broadcast: result.broadcast !== false,
      ephemeral: result.ephemeral === true,
      sender_username: HOOK.at_name,
      sender_display_name: `@${HOOK.at_name}`,
    });
  } catch (err) {
    console.error('Dice game error:', err);
    const msg = err.message || 'Unknown error';
    return res.status(500).json({
      content: `Something went wrong: ${msg}`,
      type: 'system',
      broadcast: false,
      ephemeral: true,
      sender_username: HOOK.at_name,
      sender_display_name: `@${HOOK.at_name}`,
      metadata: {
        style: { sender_color: '#a8d8ff' },
        content_spans: [
          { text: 'Something went wrong: ', color: C.muted },
          { text: msg, color: C.error },
        ],
      },
    });
  }
}
