// Simple chain service using ethers v6
// - Read helpers (contract view calls)
// - Write helper (internal only)
// - Batch execute for future filled orders array
// - A monitor skeleton to watch filled orders and execute on-chain internally
// Comments kept simple in English

const { ethers } = require('ethers');
const { getProvider, getSigner } = require('../config/ethers');

// Load ABIs from JSON files (kept minimal)
const PM_ABI = require('../abi/ProposalManager.json').abi;
const PROPOSAL_ABI = require('../abi/Proposal.json').abi;
const AUCTION_ABI = require('../abi/DutchAuction.json').abi;
const TOKEN_MIN_ABI = require('../abi/MarketToken.json').abi;

function getContract(address, abi, withSigner = false) {
  const provider = getProvider();
  const runner = withSigner ? (getSigner() || provider) : provider;
  return new ethers.Contract(address, abi, runner);
}

// Minimal iface for ProposalCreated event
const PM_EVENT_ABI = [
  {
    type: 'event',
    name: 'ProposalCreated',
    inputs: [
      { indexed: true, name: 'id', type: 'uint256' },
      { indexed: true, name: 'admin', type: 'address' },
      { indexed: false, name: 'proposal', type: 'address' },
      { indexed: false, name: 'title', type: 'string' }
    ]
  }
];
const PM_EVENT_IFACE = new ethers.Interface(PM_EVENT_ABI);
const PM_EVENT_SIGNATURE = 'ProposalCreated(uint256,address,address,string)';
const PM_EVENT_TOPIC = ethers.id(PM_EVENT_SIGNATURE);

async function callView({ address, abi, method, args = [] }) {
  if (!address || !abi || !method) throw new Error('Missing contract call params');
  const contract = getContract(address, abi, false);
  return await contract[method](...args);
}

async function sendTx({ address, abi, method, args = [], overrides = {} }) {
  const signer = getSigner();
  if (!signer) throw new Error('No signer configured');
  const contract = getContract(address, abi, true);

  // Optional gas estimation
  let gasLimit;
  try {
    gasLimit = await contract[method].estimateGas(...args, overrides);
  } catch (_) {}

  const tx = await contract[method](...args, { ...overrides, gasLimit });
  const receipt = await tx.wait();
  return { hash: tx.hash, receipt };
}

// Simple poll registry
const polls = new Map();

function startPoll(name, fn, intervalMs) {
  stopPoll(name);
  const timer = setInterval(async () => {
    try { await fn(); } catch (e) { console.error(`[poll:${name}]`, e.message); }
  }, intervalMs);
  polls.set(name, timer);
}

function stopPoll(name) {
  const t = polls.get(name);
  if (t) clearInterval(t);
  polls.delete(name);
}

function stopAllPolls() {
  for (const [name, t] of polls) clearInterval(t);
  polls.clear();
}

// Batch executor for filled book orders (future use)
// Accepts an array of { address, abi, method, args }
// Executes sequentially to avoid nonce collisions
async function executeBatch(calls, { continueOnError = true } = {}) {
  if (!Array.isArray(calls) || calls.length === 0) return [];
  const out = [];
  for (const c of calls) {
    try {
      const res = await sendTx(c);
      out.push({ ok: true, hash: res.hash });
    } catch (e) {
      out.push({ ok: false, error: e.message });
      if (!continueOnError) break;
    }
  }
  return out;
}

// Monitor skeleton: check DB for orders with status 'filled-pending' and send on-chain in batch
async function monitorFilledOrders(buildCallFromOrder) {
  // buildCallFromOrder(order) -> { address, abi, method, args }
  const Order = require('../models/Order');
  const pending = await Order.find({ status: 'filled-pending' }).sort({ createdAt: 1 }).limit(50);
  if (!pending.length) return 0;

  const calls = [];
  for (const ord of pending) {
    try {
      const call = await buildCallFromOrder(ord);
      if (call) calls.push(call);
    } catch (e) {
      console.error('monitorFilledOrders buildCall error:', e.message);
    }
  }

  const results = await executeBatch(calls);

  // Update orders with tx hashes or errors
  for (let i = 0; i < pending.length; i++) {
    try {
      const r = results[i];
      if (!r) continue;
      if (r.ok) {
        await Order.findByIdAndUpdate(pending[i]._id, { txHash: r.hash, status: 'filled-sent' });
      } else {
        await Order.findByIdAndUpdate(pending[i]._id, { status: 'filled-error' });
      }
    } catch (e) {
      console.error('monitorFilledOrders post-update error:', e.message);
    }
  }

  return results.length;
}

// Fetch proposal data from chain and sync with DB
// Input: { address, abi }
// Output: { action: 'created'|'updated'|'unchanged'|'skipped', proposal?, reason? }
async function syncProposalFromChain({ address, abi }) {
  if (!address || !abi) throw new Error('address and abi are required');
  const Proposal = require('../models/Proposal');
  const contract = getContract(address, abi, false);

  const tryRead = async (names, args = []) => {
    for (const n of names) {
      const fn = contract[n];
      if (typeof fn === 'function') {
        try { return await fn(...args); } catch (_) {}
      }
    }
    return undefined;
  };

  const raw = {
    id: await tryRead(['id', 'proposalId', 'getId']),
    admin: await tryRead(['admin', 'getAdmin', 'owner']),
    title: await tryRead(['title', 'name', 'getTitle']),
    description: await tryRead(['description', 'getDescription']),
    startTime: await tryRead(['startTime', 'getStartTime']),
    endTime: await tryRead(['endTime', 'getEndTime']),
    duration: await tryRead(['duration', 'getDuration']),
    collateralToken: await tryRead(['collateralToken', 'collateral', 'getCollateralToken']),
    maxSupply: await tryRead(['maxSupply', 'cap', 'getMaxSupply']),
    target: await tryRead(['target', 'getTarget']),
    data: await tryRead(['data', 'getData']),
    marketAddress: await tryRead(['market', 'marketAddress', 'getMarket']),
    proposalExecuted: await tryRead(['proposalExecuted', 'executed', 'isExecuted', 'getExecuted']),
    proposalEnded: await tryRead(['proposalEnded', 'ended', 'isEnded', 'getEnded'])
  };

  const asNum = (v) => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'bigint') return Number(v);
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const asStr = (v) => {
    if (v === undefined || v === null) return undefined;
    return typeof v === 'bigint' ? v.toString() : String(v);
  };
  const asAddr = (v) => {
    const s = asStr(v);
    return s ? s.toLowerCase() : undefined;
  };
  const asBool = (v) => Boolean(v);

  const onchain = {
    proposalContractId: address.toLowerCase(),
    admin: asAddr(raw.admin),
    title: raw.title !== undefined ? asStr(raw.title) : undefined,
    description: raw.description !== undefined ? asStr(raw.description) : undefined,
    startTime: asNum(raw.startTime),
    endTime: asNum(raw.endTime),
    duration: asNum(raw.duration),
    collateralToken: asAddr(raw.collateralToken),
    maxSupply: raw.maxSupply !== undefined ? asStr(raw.maxSupply) : undefined,
    target: asAddr(raw.target),
    data: raw.data !== undefined ? asStr(raw.data) : undefined,
    marketAddress: raw.marketAddress !== undefined ? asAddr(raw.marketAddress) : undefined,
    proposalExecuted: raw.proposalExecuted !== undefined ? asBool(raw.proposalExecuted) : undefined,
    proposalEnded: raw.proposalEnded !== undefined ? asBool(raw.proposalEnded) : undefined
  };

  const idNum = asNum(raw.id);
  if (idNum !== undefined) onchain.id = idNum;
  if (!onchain.duration && onchain.startTime !== undefined && onchain.endTime !== undefined) {
    onchain.duration = onchain.endTime - onchain.startTime;
  }

  // Validate required fields for creation
  const required = ['admin', 'title', 'description', 'startTime', 'endTime', 'duration', 'collateralToken', 'maxSupply', 'target'];
  const missingForCreate = required.filter(k => onchain[k] === undefined);

  // Find existing by id (if provided) or by proposalContractId
  const query = idNum !== undefined ? { id: idNum } : { proposalContractId: onchain.proposalContractId };
  let existing = await Proposal.findOne(query);

  if (!existing) {
    if (missingForCreate.length) {
      return { action: 'skipped', reason: `missing fields: ${missingForCreate.join(', ')}` };
    }
    const created = new Proposal(onchain);
    await created.save();
    return { action: 'created', proposal: created };
  }

  // Compute changed fields (only compare provided keys)
  const updatableKeys = Object.keys(onchain).filter(k => k !== 'id' && onchain[k] !== undefined);
  const toSet = {};
  for (const k of updatableKeys) {
    const newVal = onchain[k];
    const oldVal = existing[k];
    const isAddrField = ['admin','collateralToken','target','marketAddress','proposalContractId'].includes(k);
    const eq = isAddrField ? (String(oldVal || '').toLowerCase() === String(newVal || '').toLowerCase()) : (String(oldVal ?? '') === String(newVal ?? ''));
    if (!eq) toSet[k] = newVal;
  }

  if (Object.keys(toSet).length === 0) {
    return { action: 'unchanged', proposal: existing };
  }

  const updated = await Proposal.findByIdAndUpdate(existing._id, { $set: toSet }, { new: true });
  return { action: 'updated', proposal: updated };
}

// ===== Minimal ABIs for manager/proposal/auction/token =====
const ABI_MANAGER = [
  { "type": "function", "name": "getAllProposals", "stateMutability": "view", "inputs": [], "outputs": [{"type":"address[]"}] }
];
const ABI_PROPOSAL = [
  {"type":"function","name":"id","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"admin","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}]},
  {"type":"function","name":"state","stateMutability":"view","inputs":[],"outputs":[{"type":"uint8"}]},
  {"type":"function","name":"auctionStartTime","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"auctionEndTime","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"liveStart","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"liveEnd","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"liveDuration","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"subjectToken","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}]},
  {"type":"function","name":"pyUSD","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}]},
  {"type":"function","name":"minToOpen","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"maxCap","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"yesAuction","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}]},
  {"type":"function","name":"noAuction","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}]},
  {"type":"function","name":"yesToken","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}]},
  {"type":"function","name":"noToken","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}]},
  {"type":"function","name":"treasury","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}]}
];
const ABI_AUCTION = [
  {"type":"function","name":"PRICE_START","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"START_TIME","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"END_TIME","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"MIN_TO_OPEN","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"ADMIN","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}]},
  {"type":"function","name":"TREASURY","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}]},
  {"type":"function","name":"PYUSD","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}]},
  {"type":"function","name":"MARKET_TOKEN","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}]},
  {"type":"function","name":"priceNow","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"finalized","stateMutability":"view","inputs":[],"outputs":[{"type":"bool"}]},
  {"type":"function","name":"isValid","stateMutability":"view","inputs":[],"outputs":[{"type":"bool"}]},
  {"type":"function","name":"isCanceled","stateMutability":"view","inputs":[],"outputs":[{"type":"bool"}]}
];
const ABI_TOKEN_MIN = [
  {"type":"function","name":"totalSupply","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"cap","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]}
];

const toStr = (v) => (typeof v === 'bigint' ? v.toString() : String(v));
const toNum = (v) => (typeof v === 'bigint' ? Number(v) : Number(v));
const toAddr = (v) => (v ? String(v).toLowerCase() : v);

async function readProposalSnapshot(proposalAddr) {
  const c = getContract(proposalAddr, PROPOSAL_ABI, false);
  const [id, admin, st, aStart, aEnd, lStart, lEnd, lDur, subjectToken, pyusd, minToOpen, maxCap, yesAuction, noAuction, yesToken, noToken, treasury] = await Promise.all([
    c.id(), c.admin(), c.state(), c.auctionStartTime(), c.auctionEndTime(), c.liveStart(), c.liveEnd(), c.liveDuration(), c.subjectToken(), c.pyUSD(), c.minToOpen(), c.maxCap(), c.yesAuction(), c.noAuction(), c.yesToken(), c.noToken(), c.treasury()
  ]);

  // Optional metadata (older deployments may not have these; ignore errors)
  let metaTitle;
  let metaDescription;
  try { metaTitle = await c.title(); } catch (_) { metaTitle = undefined; }
  try { metaDescription = await c.description(); } catch (_) { metaDescription = undefined; }

  const startTime = toNum(aStart);
  const endTime = toNum(lEnd) > 0 ? toNum(lEnd) : (toNum(aEnd) + toNum(lDur));
  const duration = endTime && startTime ? (endTime - startTime) : toNum(lDur);
  const stateEnum = ['auction','live','resolved','cancelled'][toNum(st)] ?? 'auction';

  // YES auction snapshot
  const yes = await readAuctionSnapshot(yesAuction);
  const no = await readAuctionSnapshot(noAuction);

  // Tokens extra
  const yesTokenC = getContract(yes.marketToken, TOKEN_MIN_ABI, false);
  const noTokenC  = getContract(no.marketToken, TOKEN_MIN_ABI, false);
  const [yesSupply, yesCap, noSupply, noCap] = await Promise.all([
    yesTokenC.totalSupply(), yesTokenC.cap(), noTokenC.totalSupply(), noTokenC.cap()
  ]);

  yes.tokensSold = toStr(yesSupply);
  yes.maxTokenCap = toStr(yesCap);
  yes.minTokenCap = toStr(yes.minToOpen);

  no.tokensSold = toStr(noSupply);
  no.maxTokenCap = toStr(noCap);
  no.minTokenCap = toStr(no.minToOpen);

  return {
    // Proposal DB core
    id: toNum(id),
    proposalContractId: toAddr(proposalAddr),
    admin: toAddr(admin),
    state: stateEnum,
    // Use on-chain metadata when available
    title: metaTitle ? String(metaTitle) : undefined,
    description: metaDescription ? String(metaDescription) : undefined,
    startTime,
    endTime,
    duration,
    collateralToken: toAddr(subjectToken),
    maxSupply: toStr(maxCap),
    target: toAddr('0x0000000000000000000000000000000000000000'), // not exposed in interface currently
    data: '0x',
    marketAddress: undefined,
    // Auctions inline snapshot (strings as in schema)
    auctions: {
      yes: {
        auctionAddress: toAddr(yes.auctionAddress),
        marketToken: toAddr(yes.marketToken),
        pyusd: toAddr(pyusd),
        treasury: toAddr(treasury),
        admin: toAddr(admin),
        startTime: toNum(yes.startTime),
        endTime: toNum(yes.endTime),
        priceStart: toStr(yes.priceStart),
        minToOpen: toStr(yes.minToOpen),
        cap: toStr(maxCap),
        currentPrice: toStr(yes.currentPrice),
        tokensSold: yes.tokensSold,
        maxTokenCap: yes.maxTokenCap,
        minTokenCap: yes.minTokenCap,
        finalized: !!yes.finalized,
        isValid: !!yes.isValid,
        isCanceled: !!yes.isCanceled
      },
      no: {
        auctionAddress: toAddr(no.auctionAddress),
        marketToken: toAddr(no.marketToken),
        pyusd: toAddr(pyusd),
        treasury: toAddr(treasury),
        admin: toAddr(admin),
        startTime: toNum(no.startTime),
        endTime: toNum(no.endTime),
        priceStart: toStr(no.priceStart),
        minToOpen: toStr(no.minToOpen),
        cap: toStr(maxCap),
        currentPrice: toStr(no.currentPrice),
        tokensSold: no.tokensSold,
        maxTokenCap: no.maxTokenCap,
        minTokenCap: no.minTokenCap,
        finalized: !!no.finalized,
        isValid: !!no.isValid,
        isCanceled: !!no.isCanceled
      }
    }
  };
}

async function readAuctionSnapshot(auctionAddr) {
  const a = getContract(auctionAddr, AUCTION_ABI, false);
  const [priceStart, start, end, minToOpen, admin, treasury, pyusd, marketToken, priceNow, isFinalized, isValid, isCanceled] = await Promise.all([
    a.PRICE_START(), a.START_TIME(), a.END_TIME(), a.MIN_TO_OPEN(), a.ADMIN(), a.TREASURY(), a.PYUSD(), a.MARKET_TOKEN(), a.priceNow(), a.isFinalized(), a.isValid(), a.isCanceled()
  ]);
  return {
    auctionAddress: toAddr(auctionAddr),
    marketToken: toAddr(marketToken),
    pyusd: toAddr(pyusd),
    treasury: toAddr(treasury),
    admin: toAddr(admin),
    startTime: toNum(start),
    endTime: toNum(end),
    priceStart: toStr(priceStart),
    minToOpen: toStr(minToOpen),
    currentPrice: toStr(priceNow),
    finalized: !!isFinalized,
    isValid: !!isValid,
    isCanceled: !!isCanceled
  };
}

async function upsertProposalAndAuctions(snapshot) {
  const Proposal = require('../models/Proposal');
  const Auction = require('../models/Auction');

  // Provide fallbacks for required fields not on-chain
  const fallbackTitle = snapshot.title ?? `Proposal #${snapshot.id}`;
  const fallbackDesc = snapshot.description ?? 'Synced from chain';

  // Find existing by id or by proposalContractId
  const query = snapshot.id ? { id: snapshot.id } : { proposalContractId: snapshot.proposalContractId };
  let doc = await Proposal.findOne(query);

  const baseFields = {
    proposalContractId: snapshot.proposalContractId,
    admin: snapshot.admin,
    state: snapshot.state,
    title: fallbackTitle,
    description: fallbackDesc,
    startTime: snapshot.startTime,
    endTime: snapshot.endTime,
    duration: snapshot.duration,
    collateralToken: snapshot.collateralToken,
    maxSupply: snapshot.maxSupply,
    target: snapshot.target ?? '0x0000000000000000000000000000000000000000',
    data: snapshot.data ?? '0x',
    marketAddress: snapshot.marketAddress
  };

  if (!doc) {
    const toCreate = { ...baseFields };
    if (snapshot.id !== undefined) toCreate.id = snapshot.id;
    doc = new Proposal(toCreate);
    await doc.save();
  } else {
    // Update only changed
    const toSet = {};
    for (const k of Object.keys(baseFields)) {
      const oldVal = doc[k];
      const newVal = baseFields[k];
      const isAddr = ['proposalContractId','admin','collateralToken','target','marketAddress'].includes(k);
      const eq = isAddr ? (String(oldVal || '').toLowerCase() === String(newVal || '').toLowerCase()) : (String(oldVal ?? '') === String(newVal ?? ''));
      if (!eq) toSet[k] = newVal;
    }
    if (Object.keys(toSet).length) {
      doc = await Proposal.findByIdAndUpdate(doc._id, { $set: toSet }, { new: true });
    }
  }

  const proposalIdStr = String(doc.id);

  // Upsert Auction docs and update Proposal.auctions snapshot
  const upsertAuction = async (side, a) => {
    if (!a || !a.auctionAddress) return;
    const payload = {
      proposalId: proposalIdStr,
      side,
      auctionAddress: a.auctionAddress,
      marketToken: a.marketToken,
      pyusd: a.pyusd,
      treasury: a.treasury,
      admin: a.admin,
      startTime: a.startTime,
      endTime: a.endTime,
      priceStart: a.priceStart,
      minToOpen: a.minToOpen,
      cap: a.cap ?? snapshot.maxSupply,
      currentPrice: a.currentPrice,
      tokensSold: a.tokensSold,
      maxTokenCap: a.maxTokenCap,
      minTokenCap: a.minTokenCap,
      finalized: a.finalized,
      isValid: a.isValid,
      isCanceled: a.isCanceled
    };

    await Auction.findOneAndUpdate(
      { proposalId: proposalIdStr, side },
      { $set: payload, $setOnInsert: { proposalId: proposalIdStr, side } },
      { upsert: true, new: true }
    );
  };

  await Promise.all([
    upsertAuction('yes', snapshot.auctions?.yes),
    upsertAuction('no', snapshot.auctions?.no)
  ]);

  // Persist snapshot inside Proposal document
  const auctionsSnapshot = { yes: snapshot.auctions?.yes || null, no: snapshot.auctions?.no || null };
  await Proposal.findByIdAndUpdate(doc._id, { $set: { auctions: auctionsSnapshot } });

  return doc;
}

// Sync using a Proposal contract address
async function syncProposalByAddress(proposalAddress) {
  const snap = await readProposalSnapshot(proposalAddress);
  const doc = await upsertProposalAndAuctions(snap);
  return { id: doc.id, address: proposalAddress, action: 'synced' };
}

// Sync all proposals from a ProposalManager
async function syncProposalsFromManager({ manager }) {
  const c = getContract(manager, PM_ABI, false);
  const addrs = await c.getAllProposals();
  const results = [];
  for (const addr of addrs) {
    try {
      const r = await syncProposalByAddress(addr);
      results.push(r);
    } catch (e) {
      results.push({ address: addr, error: e.message });
    }
  }
  return results;
}

// Subscribe to ProposalManager ProposalCreated and backfill
async function startProposalManagerWatcher({ manager, fromBlock }) {
  const provider = getProvider();
  const abi = require('../abi/ProposalManager.json').abi;
  const pm = new ethers.Contract(manager, abi, provider);

  // Helper: process one event
  const handleEvent = async (id, admin, proposal, title, log) => {
    try {
      const snap = await readProposalSnapshot(proposal);
      // Fill title/description from event when available
      if (!snap.title) snap.title = title || `Proposal #${snap.id}`;
      if (!snap.description) snap.description = 'Synced from event';
      await upsertProposalAndAuctions(snap);
      return true;
    } catch (e) {
      console.error('handleEvent error:', e.message);
      return false;
    }
  };

  // Historical backfill using queryFilter
  try {
    const eventFrag = pm.interface.getEvent('ProposalCreated');
    const topic = pm.interface.getEventTopic(eventFrag);
    const filter = { address: manager, topics: [topic] };
    const latest = await provider.getBlockNumber();

    let start = Number(fromBlock || process.env.PM_FROM_BLOCK || 0);
    const step = 2_000; // paginate to avoid RPC limits
    while (start <= latest) {
      const end = Math.min(start + step, latest);
      const logs = await provider.getLogs({ ...filter, fromBlock: start, toBlock: end });
      for (const log of logs) {
        const parsed = pm.interface.parseLog(log);
        const [id, admin, proposal, title] = parsed.args;
        await handleEvent(Number(id), String(admin), String(proposal), String(title), log);
      }
      start = end + 1;
    }
  } catch (e) {
    console.warn('PM backfill skipped:', e.message);
  }

  // Live subscription
  pm.on('ProposalCreated', async (id, admin, proposal, title, ev) => {
    await handleEvent(Number(id), String(admin), String(proposal), String(title), ev?.log ?? ev);
  });

  return true;
}

// --------------------
// ProposalCreated watcher (backfill + live)
// --------------------
async function getCursor(key) {
  try {
    const Counter = require('../models/Counter');
    const c = await Counter.findById(key);
    return c?.seq || 0;
  } catch (_) { return 0; }
}

async function setCursor(key, value) {
  try {
    const Counter = require('../models/Counter');
    await Counter.findByIdAndUpdate(
      key,
      { $set: { seq: Number(value) } },
      { upsert: true, new: true }
    );
  } catch (e) {
    console.error('setCursor error:', e.message);
  }
}

function toLower(a) { return a ? String(a).toLowerCase() : a; }

async function handleProposalCreatedLog(io, log) {
  try {
    const parsed = PM_EVENT_IFACE.parseLog(log);
    const id = Number(parsed.args.id);
    const admin = toLower(parsed.args.admin);
    const proposalAddr = toLower(parsed.args.proposal);
    const title = String(parsed.args.title);

    // Sync from chain (reads full snapshot and upserts auctions too)
    const { syncProposalByAddress } = module.exports; // self-reference
    const { notifyProposalUpdate } = require('../middleware/websocket');

    await syncProposalByAddress(proposalAddr);

    // Fetch updated doc for broadcast
    const Proposal = require('../models/Proposal');
    const doc = await Proposal.findOne({ $or: [ { id }, { proposalContractId: proposalAddr } ] });
    if (doc && io) notifyProposalUpdate(io, doc);
  } catch (e) {
    console.error('handleProposalCreatedLog error:', e.message);
    // Fallback: minimally upsert the proposal so API is populated; poll will enrich later
    try {
      const parsed = PM_EVENT_IFACE.parseLog(log);
      const id = Number(parsed.args.id);
      const admin = toLower(parsed.args.admin);
      const proposalAddr = toLower(parsed.args.proposal);
      const title = String(parsed.args.title || `Proposal #${id}`);
      const Proposal = require('../models/Proposal');

      const existing = await Proposal.findOne({ $or: [ { id }, { proposalContractId: proposalAddr } ] });
      if (!existing) {
        const now = Math.floor(Date.now() / 1000);
        await Proposal.create({
          id,
          proposalContractId: proposalAddr,
          admin,
          title,
          description: 'Pending sync',
          startTime: now,
          endTime: now + 86400,
          duration: 86400,
          collateralToken: '0x0000000000000000000000000000000000000000',
          maxSupply: '0',
          target: '0x0000000000000000000000000000000000000000',
          data: '0x',
          state: 'auction',
          auctions: null
        });
      }
    } catch (e2) {
      console.error('fallback minimal upsert failed:', e2.message);
    }
  }
}

async function backfillProposalCreated({ manager, fromBlock, toBlock, io }) {
  const provider = getProvider();
  const latest = toBlock ?? (await provider.getBlockNumber());
  const start = Math.max(0, Number(fromBlock ?? (latest - 5000)));
  const step = 3000; // chunk size to avoid RPC limits

  for (let from = start; from <= latest; from += step + 1) {
    const to = Math.min(latest, from + step);
    const filter = {
      address: manager,
      fromBlock: from,
      toBlock: to,
      topics: [PM_EVENT_TOPIC]
    };
    try {
      const logs = await provider.getLogs(filter);
      for (const log of logs) {
        await handleProposalCreatedLog(io, log);
        await setCursor(`cursor:pm:${toLower(manager)}`, Number(log.blockNumber));
      }
    } catch (e) {
      console.error(`backfill logs ${from}-${to} error:`, e.message);
    }
  }
}

let liveSubActive = false;
function startProposalCreatedWatcher({ manager, confirmations = 0, fromBlock } = {}) {
  if (!manager) throw new Error('manager address required');
  const provider = getProvider();
  const addr = toLower(manager);
  const key = `cursor:pm:${addr}`;

  // Ensure single subscription
  if (liveSubActive) return;
  liveSubActive = true;

  (async () => {
    try {
      // Determine backfill start
      const latest = await provider.getBlockNumber();
      let startBlock = Number(fromBlock || (await getCursor(key)));
      if (!startBlock || startBlock <= 0) {
        const envStart = Number(process.env.PM_START_BLOCK || process.env.PROPOSAL_MANAGER_START_BLOCK || 0);
        startBlock = envStart > 0 ? envStart : Math.max(0, latest - 5000);
      }
      const io = require('../server').io;
      await backfillProposalCreated({ manager: addr, fromBlock: startBlock, toBlock: latest, io });

      // Live subscription
      const filter = { address: addr, topics: [PM_EVENT_TOPIC] };
      provider.on(filter, async (log) => {
        try {
          // Optional confirmations: ignore if not enough confirmations yet
          if (confirmations && confirmations > 0) {
            const block = await provider.getBlockNumber();
            if (block - Number(log.blockNumber) < confirmations) return;
          }
          const ioInst = require('../server').io;
          await handleProposalCreatedLog(ioInst, log);
          await setCursor(key, Number(log.blockNumber));
        } catch (e) {
          console.error('live ProposalCreated handler error:', e.message);
        }
      });
      console.log(`Subscribed to ProposalCreated on ${addr}`);
    } catch (e) {
      console.error('startProposalCreatedWatcher error:', e.message);
    }
  })();
}

module.exports = {
  getContract,
  callView,
  sendTx,
  startPoll,
  stopPoll,
  stopAllPolls,
  executeBatch,
  monitorFilledOrders,
  syncProposalFromChain,
  // new exports
  syncProposalsFromManager,
  syncProposalByAddress,
  startProposalCreatedWatcher
};
