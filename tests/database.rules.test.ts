import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

let env: RulesTestEnvironment;

const ROOM = "room1";
const Q = "q1";
const POLL = "poll1";

const question = (status: "pending" | "approved", extra: Record<string, unknown> = {}) => ({
  roomId: ROOM,
  text: "質問です",
  companyName: null,
  authorName: null,
  likes: 0,
  status,
  isAnswered: false,
  isHidden: false,
  browserSessionId: "s1",
  createdAt: 1,
  ...extra,
});

const anon = () => env.unauthenticatedContext().database();
const host = () =>
  env.authenticatedContext("host", { email: "host@rimo.app", email_verified: true }).database();
const outsider = () =>
  env.authenticatedContext("outsider", { email: "someone@gmail.com", email_verified: true }).database();
const unverified = () =>
  env.authenticatedContext("unverified", { email: "fake@rimo.app", email_verified: false }).database();
const lookalike = () =>
  env.authenticatedContext("lookalike", { email: "x@rimo.app.evil.com", email_verified: true }).database();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "rimo-qa",
    database: { rules: readFileSync(process.env.RULES_FILE ?? "database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref().set({
      rooms: { [ROOM]: { code: "ABC123", isOpen: true, title: "t", settings: { requireApproval: true, slackWebhookUrl: "" } } },
      questions: { [ROOM]: { [Q]: question("pending") } },
      polls: { [ROOM]: { [POLL]: { title: "p", status: "active", options: ["a", "b"] } } },
      visitors: { [ROOM]: { s1: { firstAccessAt: 1, companyName: "Acme", authorName: "Taro" } } },
      ratings: { [ROOM]: { s1: 5 } },
    });
  });
});

describe("未認証・非ホストは管理操作できない", () => {
  for (const [label, db] of [["未認証", anon], ["他ドメイン", outsider], ["メール未検証", unverified], ["類似ドメイン", lookalike]] as const) {
    describe(label, () => {
      it("ルーム作成・更新・削除", async () => {
        await assertFails(db().ref("rooms/new").set({ code: "X", isOpen: true }));
        await assertFails(db().ref(`rooms/${ROOM}`).update({ isOpen: false }));
        await assertFails(db().ref(`rooms/${ROOM}`).remove());
      });
      it("質問の承認・回答済み・非表示・返信・削除", async () => {
        await assertFails(db().ref(`questions/${ROOM}/${Q}`).update({ status: "approved" }));
        await assertFails(db().ref(`questions/${ROOM}/${Q}/status`).set("rejected"));
        await assertFails(db().ref(`questions/${ROOM}/${Q}`).update({ isAnswered: true }));
        await assertFails(db().ref(`questions/${ROOM}/${Q}`).update({ isHidden: true }));
        await assertFails(db().ref(`questions/${ROOM}/${Q}/replies/r1`).set({ text: "x", isPrivate: false, createdAt: 1 }));
        await assertFails(db().ref(`questions/${ROOM}/${Q}/text`).set("改ざん"));
        await assertFails(db().ref(`questions/${ROOM}`).remove());
      });
      it("投票の作成・状態変更・削除", async () => {
        await assertFails(db().ref(`polls/${ROOM}/new`).set({ title: "x", status: "active" }));
        await assertFails(db().ref(`polls/${ROOM}/${POLL}/status`).set("closed"));
        await assertFails(db().ref(`polls/${ROOM}/${POLL}`).remove());
      });
      it("参加者一覧・評価の一括閲覧", async () => {
        await assertFails(db().ref(`visitors/${ROOM}`).get());
        await assertFails(db().ref(`ratings/${ROOM}`).get());
        await assertFails(db().ref().get());
      });
    });
  }
});

describe("ホスト（@rimo.app・検証済み）は管理操作できる", () => {
  it("ルーム・質問・投票・参加者", async () => {
    await assertSucceeds(host().ref("rooms/new").set({ code: "X", isOpen: true }));
    await assertSucceeds(host().ref(`questions/${ROOM}/${Q}`).update({ status: "approved", isAnswered: true }));
    await assertSucceeds(host().ref(`questions/${ROOM}/${Q}/replies/r1`).set({ text: "回答", isPrivate: false, createdAt: 1 }));
    await assertSucceeds(host().ref(`polls/${ROOM}/${POLL}/status`).set("closed"));
    await assertSucceeds(host().ref(`visitors/${ROOM}`).get());
    await assertSucceeds(host().ref(`ratings/${ROOM}`).get());
    await assertSucceeds(host().ref(`rooms/${ROOM}`).remove());
    await assertSucceeds(host().ref(`questions/${ROOM}`).remove());
  });
});

describe("参加者（未認証）の通常操作は維持される", () => {
  it("ルームのコード検索と閲覧", async () => {
    await assertSucceeds(anon().ref("rooms").orderByChild("code").equalTo("ABC123").get());
    await assertSucceeds(anon().ref("rooms").get());
    await assertSucceeds(anon().ref(`questions/${ROOM}`).get());
    await assertSucceeds(anon().ref(`polls/${ROOM}`).get());
  });
  it("承認制ルームへの質問投稿は pending のみ", async () => {
    await assertSucceeds(anon().ref(`questions/${ROOM}`).push(question("pending")));
    await assertFails(anon().ref(`questions/${ROOM}`).push(question("approved")));
    await assertFails(anon().ref(`questions/${ROOM}`).push(question("pending", { isAnswered: true })));
    await assertFails(anon().ref(`questions/${ROOM}`).push(question("pending", { likes: 100 })));
    await assertFails(anon().ref(`questions/${ROOM}`).push(question("pending", { replies: { r: { text: "x" } } })));
  });
  it("承認なしルームでは approved で投稿できる", async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.database().ref(`rooms/${ROOM}/settings/requireApproval`).set(false));
    await assertSucceeds(anon().ref(`questions/${ROOM}`).push(question("approved")));
  });
  it("締め切ったルーム・存在しないルームには投稿できない", async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.database().ref(`rooms/${ROOM}/isOpen`).set(false));
    await assertFails(anon().ref(`questions/${ROOM}`).push(question("pending")));
    await assertFails(anon().ref("questions/nope").push(question("pending", { roomId: "nope" })));
  });
  it("いいねの付け外し（transaction）", async () => {
    const db = anon();
    await assertSucceeds(db.ref(`questions/${ROOM}/${Q}/likedBy/s2`).transaction((cur) => (cur ? null : true)));
    await assertSucceeds(db.ref(`questions/${ROOM}/${Q}/likes`).transaction((n) => Math.max(0, (n || 0) + 1)));
    await assertSucceeds(db.ref(`questions/${ROOM}/${Q}/likedBy/s2`).transaction((cur) => (cur ? null : true)));
    await assertFails(db.ref(`questions/${ROOM}/${Q}/likes`).set(-1));
    await assertFails(db.ref(`questions/${ROOM}/missing/likes`).set(1));
  });
  it("実施中の投票にのみ投票できる", async () => {
    await assertSucceeds(anon().ref(`polls/${ROOM}/${POLL}/votes/s2`).set([0, 1]));
    await env.withSecurityRulesDisabled((ctx) => ctx.database().ref(`polls/${ROOM}/${POLL}/status`).set("closed"));
    await assertFails(anon().ref(`polls/${ROOM}/${POLL}/votes/s3`).set([0]));
  });
  it("自分の入室記録の作成・読み取り・更新", async () => {
    const ref = anon().ref(`visitors/${ROOM}/s2`);
    await assertSucceeds(ref.get());
    await assertSucceeds(ref.set({ firstAccessAt: 1, companyName: null, authorName: null }));
    await assertSucceeds(ref.update({ companyName: "Rimo", authorName: "Hanako" }));
    await assertFails(ref.remove());
  });
  it("評価の送信", async () => {
    await assertSucceeds(anon().ref(`ratings/${ROOM}/s2`).set(4));
    await assertFails(anon().ref(`ratings/${ROOM}/s2`).set("x"));
  });
});
