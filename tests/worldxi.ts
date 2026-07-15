/**
 * WorldXI Anchor programı - localnet entegrasyon testleri.
 *
 * Kapsam:
 *  - init_tournament, register_player, create_profile
 *  - submit_squad (geçerli) + zincirde validasyon reddleri
 *    (OverBudget, CountryLimitExceeded, InvalidFormation, CaptainNotStarter)
 *  - create_player_card
 *  - set_matchday kilidi + set_lineup (TournamentLocked reddi)
 *  - commit_score CANLI güncelleme (delta ile player.total_points)
 *  - settle_squad_matchday puan matematiği (rarity bonusu + kaptan 2x) + idempotency
 *  - create/settle_sponsor_league (ödül transferi)
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Worldxi } from "../target/types/worldxi";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

// --- PDA seed önekleri (program constants ile eşleşir) ---
const TOURNAMENT_SEED = Buffer.from("tournament");
const PLAYER_SEED = Buffer.from("player");
const SQUAD_SEED = Buffer.from("squad");
const SCORE_SEED = Buffer.from("score");
const PROFILE_SEED = Buffer.from("profile");
const CARD_SEED = Buffer.from("card");
const LEAGUE_SEED = Buffer.from("league");

const SOL = (n: number) => new BN(Math.round(n * LAMPORTS_PER_SOL));
const u32le = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
};
const u16le = (n: number): Buffer => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
};
const iso3 = (s: string): number[] => Array.from(Buffer.from(s, "ascii")).slice(0, 3);

// Enum yardımcıları (Anchor IDL: variant isimleri camelCase)
const POS = {
  GK: { goalkeeper: {} },
  DEF: { defender: {} },
  MID: { midfielder: {} },
  FWD: { forward: {} },
} as const;
const RAR = {
  Common: { common: {} },
  Rare: { rare: {} },
  Legendary: { legendary: {} },
} as const;
const FORM = {
  F433: { f433: {} },
} as const;

describe("worldxi", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.worldxi as Program<Worldxi>;

  const authority = provider.wallet as anchor.Wallet;
  const oracle = Keypair.generate();

  const NAME = "WC2026";
  let tournamentPda: PublicKey;

  // --- Test oyuncu havuzu (17 oyuncu) ---
  // Kadro havuzu id 1..15: 2 GK, 5 DEF, 4 MID, 4 FWD; 5 ülke x 3.
  // id16: ESP FWD Legendary (OverBudget testi). id17: TUR MID (CountryLimit testi).
  interface TestPlayer {
    id: number;
    name: string;
    country: string;
    pos: unknown;
    rar: unknown;
    price: number;
  }
  const players: TestPlayer[] = [
    { id: 1, name: "GK-TUR-A", country: "TUR", pos: POS.GK, rar: RAR.Common, price: 0.5 },
    { id: 2, name: "GK-TUR-B", country: "TUR", pos: POS.GK, rar: RAR.Common, price: 0.5 },
    { id: 3, name: "DF-TUR-C", country: "TUR", pos: POS.DEF, rar: RAR.Common, price: 0.5 },
    { id: 4, name: "DF-BRA-A", country: "BRA", pos: POS.DEF, rar: RAR.Common, price: 0.5 },
    { id: 5, name: "DF-BRA-B", country: "BRA", pos: POS.DEF, rar: RAR.Common, price: 0.5 },
    { id: 6, name: "DF-BRA-C", country: "BRA", pos: POS.DEF, rar: RAR.Common, price: 0.5 },
    { id: 7, name: "DF-ARG-A", country: "ARG", pos: POS.DEF, rar: RAR.Common, price: 0.5 },
    { id: 8, name: "MD-ARG-B", country: "ARG", pos: POS.MID, rar: RAR.Rare, price: 1.4 },
    { id: 9, name: "MD-ARG-C", country: "ARG", pos: POS.MID, rar: RAR.Common, price: 0.5 },
    { id: 10, name: "MD-FRA-A", country: "FRA", pos: POS.MID, rar: RAR.Common, price: 0.5 },
    { id: 11, name: "MD-FRA-B", country: "FRA", pos: POS.MID, rar: RAR.Common, price: 0.5 },
    { id: 12, name: "FW-FRA-C", country: "FRA", pos: POS.FWD, rar: RAR.Legendary, price: 2.0 },
    { id: 13, name: "FW-ESP-A", country: "ESP", pos: POS.FWD, rar: RAR.Common, price: 0.5 },
    { id: 14, name: "FW-ESP-B", country: "ESP", pos: POS.FWD, rar: RAR.Common, price: 0.5 },
    { id: 15, name: "FW-ESP-C", country: "ESP", pos: POS.FWD, rar: RAR.Common, price: 0.5 },
    { id: 16, name: "FW-ESP-D", country: "ESP", pos: POS.FWD, rar: RAR.Legendary, price: 2.0 },
    { id: 17, name: "MD-TUR-D", country: "TUR", pos: POS.MID, rar: RAR.Common, price: 0.5 },
  ];

  // Geçerli 4-3-3 kadro (owner = authority)
  const SQUAD = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 2]; // 15 oyuncu
  const STARTERS = [1, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14]; // GK + 4 DEF + 3 MID + 3 FWD
  const CAPTAIN = 12; // Legendary FWD

  const playerPda = (id: number): PublicKey =>
    PublicKey.findProgramAddressSync(
      [PLAYER_SEED, tournamentPda.toBuffer(), u32le(id)],
      program.programId
    )[0];
  const squadPda = (owner: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [SQUAD_SEED, tournamentPda.toBuffer(), owner.toBuffer()],
      program.programId
    )[0];
  const profilePda = (owner: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync([PROFILE_SEED, owner.toBuffer()], program.programId)[0];
  const cardPda = (owner: PublicKey, id: number): PublicKey =>
    PublicKey.findProgramAddressSync(
      [CARD_SEED, tournamentPda.toBuffer(), owner.toBuffer(), u32le(id)],
      program.programId
    )[0];
  const scorePda = (matchday: number, id: number): PublicKey =>
    PublicKey.findProgramAddressSync(
      [SCORE_SEED, tournamentPda.toBuffer(), u16le(matchday), u32le(id)],
      program.programId
    )[0];

  const fund = async (kp: Keypair, sol = 100): Promise<void> => {
    const sig = await provider.connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig, "confirmed");
  };

  const submitFor = async (
    owner: PublicKey,
    squad: number[],
    starters: number[],
    formation: unknown,
    captain: number,
    signers: Keypair[] = []
  ): Promise<void> => {
    await program.methods
      .submitSquad(squad, starters, formation as never, captain)
      .accounts({ tournament: tournamentPda, owner })
      .remainingAccounts(
        squad.map((id) => ({ pubkey: playerPda(id), isSigner: false, isWritable: false }))
      )
      .signers(signers)
      .rpc();
  };

  before(async () => {
    tournamentPda = PublicKey.findProgramAddressSync(
      [TOURNAMENT_SEED, Buffer.from(NAME)],
      program.programId
    )[0];
    // Oracle, commit_score'da ScoreCommit hesaplarının rent'ini öder -> fonlanmalı.
    await fund(oracle);
  });

  it("init_tournament: 10 SOL bütçe ve oracle ile kurar", async () => {
    await program.methods
      .initTournament(NAME, SOL(10), oracle.publicKey)
      .accounts({ authority: authority.publicKey })
      .rpc();

    const t = await program.account.tournament.fetch(tournamentPda);
    assert.equal(t.name, NAME);
    assert.equal(t.budgetLamports.toString(), SOL(10).toString());
    assert.ok(t.oracle.equals(oracle.publicKey));
    assert.equal(t.locked, false);
    assert.equal(t.currentMatchday, 0);
  });

  it("register_player: 17 oyuncuyu kaydeder (sadece authority)", async () => {
    for (const p of players) {
      await program.methods
        .registerPlayer(p.id, p.name, iso3(p.country), p.pos as never, p.rar as never, SOL(p.price))
        .accounts({ tournament: tournamentPda, authority: authority.publicKey })
        .rpc();
    }
    const p12 = await program.account.player.fetch(playerPda(12));
    assert.equal(p12.playerId, 12);
    assert.deepEqual(p12.country, iso3("FRA"));
    assert.equal(p12.priceLamports.toString(), SOL(2.0).toString());
  });

  it("register_player: authority olmayan reddedilir", async () => {
    const rogue = Keypair.generate();
    await fund(rogue);
    try {
      await program.methods
        .registerPlayer(99, "X", iso3("TUR"), POS.GK as never, RAR.Common as never, SOL(0.3))
        .accounts({ tournament: tournamentPda, authority: rogue.publicKey })
        .signers([rogue])
        .rpc();
      assert.fail("authority olmayan register kabul edilmemeliydi");
    } catch (e: unknown) {
      assert.match(String(e), /UnauthorizedAuthority|has one|ConstraintHasOne/i);
    }
  });

  it("create_profile: geçerli kabul, >24 char nickname reddedilir", async () => {
    await program.methods
      .createProfile("kaptan_alpha", iso3("TUR"))
      .accounts({ owner: authority.publicKey })
      .rpc();
    const pr = await program.account.userProfile.fetch(profilePda(authority.publicKey));
    assert.equal(pr.nickname, "kaptan_alpha");

    const longNick = Keypair.generate();
    await fund(longNick);
    try {
      await program.methods
        .createProfile("x".repeat(25), null)
        .accounts({ owner: longNick.publicKey })
        .signers([longNick])
        .rpc();
      assert.fail("25 karakter nickname kabul edilmemeliydi");
    } catch (e: unknown) {
      assert.match(String(e), /NicknameTooLong/);
    }
  });

  it("submit_squad: geçerli 4-3-3 kadroyu kabul eder ve harcamayı doğrular", async () => {
    await submitFor(authority.publicKey, SQUAD, STARTERS, FORM.F433, CAPTAIN);
    const s = await program.account.squad.fetch(squadPda(authority.publicKey));
    // 9.9 SOL = 2.0 + 1.4 + 13*0.5
    assert.equal(s.spentLamports.toString(), SOL(9.9).toString());
    assert.equal(s.captain, CAPTAIN);
    assert.deepEqual([...s.starters], STARTERS);

    const t = await program.account.tournament.fetch(tournamentPda);
    assert.equal(t.squadCount.toString(), "1");
  });

  it("submit_squad: OverBudget reddeder (id16 Legendary ile toplam > 10 SOL)", async () => {
    const ownerB = Keypair.generate();
    await fund(ownerB);
    // id15 yerine id16 (Legendary 2.0) -> toplam 9.9 - 0.5 + 2.0 = 11.4 SOL
    const squad = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 2];
    try {
      await submitFor(ownerB.publicKey, squad, STARTERS, FORM.F433, CAPTAIN, [ownerB]);
      assert.fail("OverBudget reddedilmeliydi");
    } catch (e: unknown) {
      assert.match(String(e), /OverBudget/);
    }
  });

  it("submit_squad: InvalidFormation reddeder (F433 beklerken 5-3-2 dağılımı)", async () => {
    const ownerC = Keypair.generate();
    await fund(ownerC);
    // 5 DEF + 3 MID + 2 FWD = geçersiz F433
    const badStarters = [1, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13];
    try {
      await submitFor(ownerC.publicKey, SQUAD, badStarters, FORM.F433, 12, [ownerC]);
      assert.fail("InvalidFormation reddedilmeliydi");
    } catch (e: unknown) {
      assert.match(String(e), /InvalidFormation/);
    }
  });

  it("submit_squad: CountryLimitExceeded reddeder (4 TUR oyuncusu)", async () => {
    const ownerD = Keypair.generate();
    await fund(ownerD);
    // TUR: 1,2,3,17 (4 tane) -> ihlal
    const squad = [1, 2, 3, 17, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    const starters = [1, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14];
    try {
      await submitFor(ownerD.publicKey, squad, starters, FORM.F433, 12, [ownerD]);
      assert.fail("CountryLimitExceeded reddedilmeliydi");
    } catch (e: unknown) {
      assert.match(String(e), /CountryLimitExceeded/);
    }
  });

  it("submit_squad: CaptainNotStarter reddeder (kaptan yedeklerden)", async () => {
    const ownerE = Keypair.generate();
    await fund(ownerE);
    try {
      await submitFor(ownerE.publicKey, SQUAD, STARTERS, FORM.F433, 2, [ownerE]); // id2 yedek GK
      assert.fail("CaptainNotStarter reddedilmeliydi");
    } catch (e: unknown) {
      assert.match(String(e), /CaptainNotStarter/);
    }
  });

  it("create_player_card: 11 starter için kart oluşturur (rarity Player'dan kopyalanır)", async () => {
    for (const id of STARTERS) {
      const mint = Keypair.generate().publicKey; // gerçek akışta cNFT asset id
      await program.methods
        .createPlayerCard(id, mint)
        .accounts({
          tournament: tournamentPda,
          player: playerPda(id),
          owner: authority.publicKey,
        })
        .rpc();
    }
    const card12 = await program.account.playerCard.fetch(cardPda(authority.publicKey, 12));
    assert.equal(card12.playerId, 12);
    assert.deepEqual(card12.rarity, RAR.Legendary);
    assert.equal(card12.matchesPlayed, 0);
  });

  it("set_matchday + set_lineup: kilitliyken reddeder, açıkken kabul eder", async () => {
    await program.methods
      .setMatchday(1, true)
      .accounts({ tournament: tournamentPda, oracle: oracle.publicKey })
      .signers([oracle])
      .rpc();

    try {
      await program.methods
        .setLineup(STARTERS, FORM.F433 as never, CAPTAIN)
        .accounts({
          tournament: tournamentPda,
          squad: squadPda(authority.publicKey),
          owner: authority.publicKey,
        })
        .remainingAccounts(
          STARTERS.map((id) => ({ pubkey: playerPda(id), isSigner: false, isWritable: false }))
        )
        .rpc();
      assert.fail("kilitliyken set_lineup reddedilmeliydi");
    } catch (e: unknown) {
      assert.match(String(e), /TournamentLocked/);
    }

    await program.methods
      .setMatchday(1, false)
      .accounts({ tournament: tournamentPda, oracle: oracle.publicKey })
      .signers([oracle])
      .rpc();
    await program.methods
      .setLineup(STARTERS, FORM.F433 as never, CAPTAIN)
      .accounts({
        tournament: tournamentPda,
        squad: squadPda(authority.publicKey),
        owner: authority.publicKey,
      })
      .remainingAccounts(
        STARTERS.map((id) => ({ pubkey: playerPda(id), isSigner: false, isWritable: false }))
      )
      .rpc();
  });

  it("commit_score: CANLI günceller - delta ile player.total_points doğru", async () => {
    await program.methods
      .commitScore(1, 12, 6, false)
      .accounts({ tournament: tournamentPda, player: playerPda(12), oracle: oracle.publicKey })
      .signers([oracle])
      .rpc();
    let p12 = await program.account.player.fetch(playerPda(12));
    assert.equal(p12.totalPoints.toString(), "6");

    await program.methods
      .commitScore(1, 12, 9, true) // gol daha eklendi + MVP
      .accounts({ tournament: tournamentPda, player: playerPda(12), oracle: oracle.publicKey })
      .signers([oracle])
      .rpc();
    p12 = await program.account.player.fetch(playerPda(12));
    assert.equal(p12.totalPoints.toString(), "9"); // 6+9 değil, delta ile 9

    const sc = await program.account.scoreCommit.fetch(scorePda(1, 12));
    assert.equal(sc.rawPoints, 9);
    assert.equal(sc.wasMvp, true);
  });

  it("commit_score: oracle olmayan reddedilir", async () => {
    try {
      await program.methods
        .commitScore(1, 13, 4, false)
        .accounts({ tournament: tournamentPda, player: playerPda(13), oracle: authority.publicKey })
        .rpc();
      assert.fail("oracle olmayan commit reddedilmeliydi");
    } catch (e: unknown) {
      assert.match(String(e), /UnauthorizedOracle|has one|ConstraintHasOne/i);
    }
  });

  it("settle_squad_matchday: rarity bonusu + kaptan 2x uygular ve idempotent", async () => {
    const raws: Record<number, number> = {
      1: 5, 4: 6, 5: 4, 6: 6, 7: 3, 8: 7, 9: 4, 10: 5, 12: 9, 13: 4, 14: 3,
    };
    for (const id of STARTERS) {
      if (id === 12) continue; // zaten commit edildi (raw 9)
      await program.methods
        .commitScore(1, id, raws[id], false)
        .accounts({ tournament: tournamentPda, player: playerPda(id), oracle: oracle.publicKey })
        .signers([oracle])
        .rpc();
    }

    // Beklenen toplam (client aynası): final = floor(raw*bps/10000), kaptan ise *2
    let expected = 0;
    for (const id of STARTERS) {
      const raw = raws[id];
      let bps = 10000;
      if (id === 8) bps = 10500;
      if (id === 12) bps = 11000;
      let f = Math.floor((raw * bps) / 10000);
      if (id === CAPTAIN) f = f * 2;
      expected += f;
    }

    const remaining = STARTERS.flatMap((id) => [
      { pubkey: scorePda(1, id), isSigner: false, isWritable: false },
      { pubkey: cardPda(authority.publicKey, id), isSigner: false, isWritable: true },
    ]);

    await program.methods
      .settleSquadMatchday(1)
      .accounts({
        tournament: tournamentPda,
        squad: squadPda(authority.publicKey),
        profile: profilePda(authority.publicKey),
        crank: authority.publicKey,
      })
      .remainingAccounts(remaining)
      .rpc();

    const s = await program.account.squad.fetch(squadPda(authority.publicKey));
    assert.equal(s.totalPoints.toString(), expected.toString(), "squad toplam beklenenle eşleşmeli");
    assert.equal(s.lockedMatchday, 1);

    const pr = await program.account.userProfile.fetch(profilePda(authority.publicKey));
    assert.equal(pr.totalPoints.toString(), expected.toString());

    // Kaptan kartı: Legendary %10 + 2x, MVP sayacı arttı
    const card12 = await program.account.playerCard.fetch(cardPda(authority.publicKey, 12));
    assert.equal(card12.matchesPlayed, 1);
    assert.equal(card12.mvpCount, 1);
    const card12Expected = Math.floor((9 * 11000) / 10000) * 2; // 9*1.1=9 -> 18
    assert.equal(card12.totalPoints.toString(), card12Expected.toString());
    assert.equal(card12.bestSingleScore, card12Expected);

    // Idempotency: aynı matchday tekrar settle edilemez
    try {
      await program.methods
        .settleSquadMatchday(1)
        .accounts({
          tournament: tournamentPda,
          squad: squadPda(authority.publicKey),
          profile: profilePda(authority.publicKey),
          crank: authority.publicKey,
        })
        .remainingAccounts(remaining)
        .rpc();
      assert.fail("aynı matchday iki kez settle edilmemeliydi");
    } catch (e: unknown) {
      assert.match(String(e), /AlreadySettled/);
    }
  });

  it("sponsor_league: sponsor ödül yatırır, authority kazanana dağıtır", async () => {
    const sponsor = Keypair.generate();
    await fund(sponsor, 10);
    const winner = Keypair.generate();
    const leagueName = "SponsorCup";
    const leaguePda = PublicKey.findProgramAddressSync(
      [LEAGUE_SEED, tournamentPda.toBuffer(), Buffer.from(leagueName)],
      program.programId
    )[0];
    const prize = SOL(2);

    await program.methods
      .createSponsorLeague(leagueName, prize)
      .accounts({ tournament: tournamentPda, sponsor: sponsor.publicKey })
      .signers([sponsor])
      .rpc();

    const before = await provider.connection.getBalance(winner.publicKey);
    await program.methods
      .settleSponsorLeague()
      .accounts({
        tournament: tournamentPda,
        league: leaguePda,
        authority: authority.publicKey,
        winner: winner.publicKey,
      })
      .rpc();
    const after = await provider.connection.getBalance(winner.publicKey);
    assert.equal(after - before, prize.toNumber(), "kazanan ödülü almalı");

    const lg = await program.account.sponsorLeague.fetch(leaguePda);
    assert.equal(lg.settled, true);
    assert.ok(lg.winner.equals(winner.publicKey));
  });
});
