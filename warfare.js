import { MenAtArmType } from "./models.js";
import { logLine } from "./log.js";
import { rng } from "./core/rng.js";


// === ARMY MANAGEMENT ===

export function actionCreateRegiment(state, maaId) {
    const p = state.player;
    const maa = MenAtArmType[maaId.toUpperCase()];
    if(!maa) return {ok: false, msg: "Binh chủng không tồn tại."};
    
    // Mỗi regiment (đạo) = 10 lính tinh nhuệ
    const cost = maa.cost;
    if (p.tien < cost) return {ok: false, msg: `Cần ${cost} Quan để tuyển mộ 10 ${maa.name}.`};
    
    p.tien -= cost;
    p.armies.push({ type: maa.id, count: 10, morale: 100 });
    p.quanSo += 10; // For backward compatibility
    
    let buff = p.voThuat * 2;
    p.danhVong += 10;
    logLine(state, `Đổ ${cost} quan chiêu mộ 10 ${maa.name}. Quân thế oai hùng!`);
    return {ok: true, feedback: [{text:`- ${cost} Quan`, tone:"bad"}, {text:`+10 ${maa.name}`, tone:"good"}], sfx: "battle"};
}

// === BATTLE SIMULATOR (DICE & MORALE & COUNTERS) ===

function getArmyStats(armyArray) {
    let totalAtk = 0;
    let totalDef = 0;
    let totalMen = 0;
    let avgMorale = 0;
    let units = { hasArtillery: false };
    
    armyArray.forEach(reg => {
        const maa = MenAtArmType[reg.type?.toUpperCase() || reg.id?.toUpperCase()] || MenAtArmType.DAN_BINH;
        let count = reg.count || reg.curQuanSo || 0;
        totalAtk += maa.atk * count;
        totalDef += maa.def * count;
        totalMen += count;
        avgMorale += reg.morale || 50;
        if(maa.type === "artillery") units.hasArtillery = true;
    });
    
    if (armyArray.length > 0) avgMorale = avgMorale / armyArray.length;
    else avgMorale = 0;
    
    return { totalAtk, totalDef, totalMen, avgMorale: Math.floor(avgMorale), units };
}

function calculateCounterMultiplier(atkArmies, defArmies) {
    // Duyệt danh sách quân vả xem có khắc chế không.
    let bonus = 1.0;
    let typesA = new Set(atkArmies.map(a => MenAtArmType[a.type.toUpperCase()]?.type));
    let typesD = new Set(defArmies.map(d => MenAtArmType[d.type.toUpperCase()]?.type));
    
    atkArmies.forEach(reg => {
       const maa = MenAtArmType[reg.type.toUpperCase()];
       if (!maa || !maa.counter) return;
       maa.counter.forEach(c => {
          if (typesD.has(c)) {
             bonus += 0.15; // Mỗi class khắc chế tăng 15% damage cho phe tấn công
          }
       });
    });
    return Math.min(2.5, bonus);
}

export function simulateBattle(attacker, defender, state) {
    // attacker/defender = { name: "Nghĩa Quân", armies: [{type: "DAN_BINH", count: 100, morale: 80}], martial: 15, knights: 2, qualityMult: 1.0, isSiegeAtk: true/false }
    
    let aStats = getArmyStats(attacker.armies);
    let dStats = getArmyStats(defender.armies);
    
    let battleLogs = [];
    let day = 1;
    let aMorale = aStats.avgMorale;
    let dMorale = dStats.avgMorale;
    
    let aMen = aStats.totalMen;
    let dMen = dStats.totalMen;
    const aStartMen = aMen;
    const dStartMen = dMen;

    let aCounterMult = calculateCounterMultiplier(attacker.armies, defender.armies);
    let dCounterMult = calculateCounterMultiplier(defender.armies, attacker.armies);
    
    // Troop Quality Multiplier
    let aQual = attacker.qualityMult || 1.0;
    let dQual = defender.qualityMult || 1.0;
    // Men-at-Arms synergy (perk-driven): boosts damage side that fields MAA
    if (attacker.maaCombatMult) aQual *= attacker.maaCombatMult;
    if (defender.maaCombatMult) dQual *= defender.maaCombatMult;

    // Siege Logic: Attacking a major fortress drops attacker damage profoundly unless they have artillery
    let siegeDefBonus = 1.0;
    if (attacker.isSiegeAtk) {
        if (aStats.units.hasArtillery) {
            siegeDefBonus = 1.1; // Pháo binh bẻ gãy phòng ngự thành trì
            battleLogs.push(`🚀 Quân ${attacker.name} xả Đại Bác Thần Công đập nát cổng thành lũy! Khí thế dâng cao.`);
        } else {
            siegeDefBonus = 2.5; // Thành trì bảo vệ quân thủ
            battleLogs.push(`🏰 ${defender.name} cố thủ trong thành hiểm yếu. ${attacker.name} không có pháo binh, công thành vô vàn khó khăn!`);
            aMorale -= 10;
        }
    }
    
    // Pha đụng độ chiến sự
    while (aMorale > 15 && dMorale > 15 && aMen > 0 && dMen > 0 && day <= 10) {
        // Tướng soái roll xúc xắc chiến thuật
        let aTactics = Math.floor(rng(state) * 10) + attacker.martial;
        let dTactics = Math.floor(rng(state) * 10) + defender.martial;
        
        let aBaseDmg = (aStats.totalAtk / 5) * (aTactics / 10) * aQual * aCounterMult;
        let dBaseDmg = (dStats.totalAtk / 5) * (dTactics / 10) * dQual * dCounterMult;
        
        // Trừ thương vong (Phòng ngự thủ thành chặn damage của phe công)
        let aCasualties = Math.floor(dBaseDmg / (Math.max(1, aStats.totalDef/Math.max(1, aMen))));
        let dCasualties = Math.floor((aBaseDmg / siegeDefBonus) / (Math.max(1, dStats.totalDef/Math.max(1, dMen))));
        
        // Khắc hệ kinh khủng
        if (aQual >= 1.8 && dQual <= 0.4) dCasualties = Math.floor(dCasualties * 2.0); // Tinh Nhuệ nghiền nát Ô Hợp
        if (dQual >= 1.8 && aQual <= 0.4) aCasualties = Math.floor(aCasualties * 2.0); 

        aMen = Math.max(0, aMen - aCasualties);
        dMen = Math.max(0, dMen - dCasualties);
        
        // Sự kiện Hiệp Sĩ Solo (Truyền lửa Sĩ khí)
        if (attacker.knights > 0 && rng(state) < 0.25) {
            dMorale -= 12;
            battleLogs.push(`⚔️ MÃNH TƯỚNG ${attacker.name} lao vào xé nát đội hình, chém bay cờ đối phương!`);
        }
        if (defender.knights > 0 && rng(state) < 0.25) {
            aMorale -= 12;
            battleLogs.push(`⚔️ TRỌNG TƯỚNG ${defender.name} tử chiến bảo vệ hàng phòng ngự! Sĩ khí địch rúng động!`);
        }
        
        // Hậu cần & Tổn thất binh lính ảnh hưởng sĩ khí
        if (aCasualties > dCasualties * 2) aMorale -= 20;
        if (dCasualties > aCasualties * 2) dMorale -= 20;
        
        // Nếu tướng quá xuất chúng, vực dậy sĩ khí
        if (attacker.martial > 60 && aMorale < 40) { aMorale += 5; battleLogs.push(`Hô hào: Tướng ${attacker.name} gầm thét xốc lại đội hình!`); }
        if (defender.martial > 60 && dMorale < 40) { dMorale += 5; battleLogs.push(`Hô hào: Tướng ${defender.name} ổn định lòng quân!`); }

        battleLogs.push(`Ngày ${day}: Tàn sát tàn khốc: ${attacker.name} mất ${aCasualties} mạng. ${defender.name} mất ${dCasualties} mạng.`);
        day++;

        // Morale break / rout like CK3 (not necessarily annihilation)
        const aLossPct = (aStartMen > 0) ? (1 - aMen / aStartMen) : 1;
        const dLossPct = (dStartMen > 0) ? (1 - dMen / dStartMen) : 1;
        if (aMorale <= 22 || aLossPct >= 0.72) {
          battleLogs.push(`🏳️ ${attacker.name} vỡ trận! Tàn quân tháo chạy tán loạn.`);
          break;
        }
        if (dMorale <= 22 || dLossPct >= 0.72) {
          battleLogs.push(`🏳️ ${defender.name} vỡ trận! Tàn quân tháo chạy tán loạn.`);
          break;
        }
    }
    
    let winner = (aMorale > dMorale && aMen > 0) ? attacker.name : defender.name;
    if(aMen <= 0) winner = defender.name;
    if(dMen <= 0) winner = attacker.name;

    const aLossPctFinal = (aStartMen > 0) ? (1 - aMen / aStartMen) : 1;
    const dLossPctFinal = (dStartMen > 0) ? (1 - dMen / dStartMen) : 1;
    const outcome = {
      type: "decision", // or "rout"
      routedSide: null,
      days: day - 1
    };
    if ((aMorale <= 22 || aLossPctFinal >= 0.72) && aMen > 0) { outcome.type = "rout"; outcome.routedSide = "atk"; }
    if ((dMorale <= 22 || dLossPctFinal >= 0.72) && dMen > 0) { outcome.type = "rout"; outcome.routedSide = "def"; }

    // Capture / kill chance on rout/defeat
    let capture = null;
    if (outcome.type === "rout") {
      const losing = (winner === attacker.name) ? defender : attacker;
      const winning = (winner === attacker.name) ? attacker : defender;
      const diff = (winning.martial || 0) - (losing.martial || 0);
      const base = 0.10 + Math.max(-0.05, Math.min(0.10, diff * 0.002));
      if (rng(state) < base) {
        capture = {
          victim: losing.isPlayer ? "player" : "commander",
          victimName: losing.name,
          captorName: winning.name,
          kind: (rng(state) < 0.2) ? "killed" : "captured"
        };
      }
    }
    
    battleLogs.push(`--- TRẬN ĐÁNH NGÃ NGŨ ---`);
    if(winner === attacker.name) {
       battleLogs.push(`🏆 Quân tấn công **${winner}** đã đập tan đối thủ!`);
       if(dStats.units.hasArtillery && !aStats.units.hasArtillery) {
           battleLogs.push("🏴 CƯỚP ĐƯỢC ĐẠI BÁC: Quân thất bại bỏ lại dàn Pháo Binh Thần Công, phe chiến thắng thu làm chiến lợi phẩm!");
       }
    } else {
       battleLogs.push(`🛡️ Quân phòng thủ **${winner}** đã giữ vững trận thế, đánh lui địch!`);
       if(aStats.units.hasArtillery && !dStats.units.hasArtillery) {
           battleLogs.push("🏴 CƯỚP ĐƯỢC ĐẠI BÁC: Quần Tấn Công tháo chạy bỏ lại Pháo Binh Thần Công!");
       }
    }
    
    let promotion = null;
    let rankStr = "";
    if(winner === attacker.name && attacker.isPlayer) {
        if(dStats.totalMen >= 500) { promotion = "do_doc"; rankStr = "Đô Đốc Trấn Sở"; }
        else if(dStats.totalMen >= 100) { promotion = "tong_linh"; rankStr = "Tổng Lĩnh Nha Môn"; }
        else if(dStats.totalMen >= 50) { promotion = "bach_ho"; rankStr = "Bách Hộ"; }
        if(promotion) battleLogs.push(`[PHỦ CHÚA BAN KHEN] Công trạng dẹp giặc xuất chúng! Phong tước hiệu **${rankStr}**!`);
    }
    
    return {
        winner, battleLogs,
        remainingAttacker: aMen,
        remainingDefender: dMen,
        outcome,
        capture,
        promotion, rankStr
    };
}
