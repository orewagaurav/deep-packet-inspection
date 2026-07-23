// ============================================================================
// Block Rules — CRUD for the DPI engine's blocklist (control plane)
// ============================================================================
// The React dashboard manages rules via JSON here; the C++ engine polls the
// plain-text GET /rules/active feed and hot-reloads its blocklist.
//
//   GET    /rules          list all rules (JSON)
//   POST   /rules          create a rule
//   PATCH  /rules/:id      toggle enabled / edit note or value
//   DELETE /rules/:id      remove a rule
//   GET    /rules/active   enabled rules as "type value" lines (for the engine)
// ============================================================================

const { Router } = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/database");
const { emitEvent } = require("../services/socketManager");

const router = Router();

const VALID_TYPES = ["ip", "app", "domain"];

// --------------------------------------------------------------------------
// GET /rules/active — plain text, enabled rules only. Consumed by the engine.
// Must be declared before "/:id"-style routes (it isn't ambiguous, but keep
// the engine-facing contract obvious and cheap).
// --------------------------------------------------------------------------
router.get("/active", async (_req, res, next) => {
  try {
    const db = getDB();
    const rules = await db
      .collection("rules")
      .find({ enabled: true })
      .project({ type: 1, value: 1, _id: 0 })
      .toArray();

    const body = rules.map((r) => `${r.type} ${r.value}`).join("\n");
    res.type("text/plain").send(body + (body ? "\n" : ""));
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// GET /rules — list all rules (newest first)
// --------------------------------------------------------------------------
router.get("/", async (_req, res, next) => {
  try {
    const db = getDB();
    const data = await db
      .collection("rules")
      .find({})
      .sort({ created_at: -1 })
      .toArray();
    res.json({ total: data.length, data });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// POST /rules — create a rule
// --------------------------------------------------------------------------
router.post("/", async (req, res, next) => {
  try {
    const db = getDB();
    const type = String(req.body.type || "").toLowerCase().trim();
    const value = String(req.body.value || "").trim();
    const note = String(req.body.note || "").trim();
    const enabled = req.body.enabled === undefined ? true : Boolean(req.body.enabled);

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of ${VALID_TYPES.join(", ")}` });
    }
    if (!value) {
      return res.status(400).json({ error: "value is required" });
    }

    const doc = { type, value, note, enabled, created_at: new Date() };

    let result;
    try {
      result = await db.collection("rules").insertOne(doc);
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ error: "That rule already exists" });
      }
      throw e;
    }

    const created = { ...doc, _id: result.insertedId };
    emitEvent("rules_update", { action: "create", rule: created });
    res.status(201).json({ success: true, rule: created });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// PATCH /rules/:id — toggle enabled / edit value or note
// --------------------------------------------------------------------------
router.patch("/:id", async (req, res, next) => {
  try {
    const db = getDB();
    let _id;
    try {
      _id = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ error: "invalid rule id" });
    }

    const update = {};
    if (req.body.enabled !== undefined) update.enabled = Boolean(req.body.enabled);
    if (req.body.note !== undefined) update.note = String(req.body.note).trim();
    if (req.body.value !== undefined) {
      const value = String(req.body.value).trim();
      if (!value) return res.status(400).json({ error: "value cannot be empty" });
      update.value = value;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "nothing to update" });
    }

    const result = await db.collection("rules").updateOne({ _id }, { $set: update });
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "rule not found" });
    }

    const updated = await db.collection("rules").findOne({ _id });
    emitEvent("rules_update", { action: "update", rule: updated });
    res.json({ success: true, rule: updated });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// DELETE /rules/:id
// --------------------------------------------------------------------------
router.delete("/:id", async (req, res, next) => {
  try {
    const db = getDB();
    let _id;
    try {
      _id = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ error: "invalid rule id" });
    }

    const result = await db.collection("rules").deleteOne({ _id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "rule not found" });
    }

    emitEvent("rules_update", { action: "delete", id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
