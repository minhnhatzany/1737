import { createInitialState } from "./engine.js";
import { totalPops } from "./models.js";

const state = createInitialState("PlayerName");
const initialPops = totalPops(state.village);
console.log("Initial totalPops:", initialPops);

const round = JSON.parse(JSON.stringify(state));
const roundPops = totalPops(round.village);
console.log("Round-trip totalPops:", roundPops);

const initialDinh = Math.floor(initialPops / 5);
const roundDinh = Math.floor(roundPops / 5);

const pass = !Number.isNaN(initialDinh) && !Number.isNaN(roundDinh);
if (pass) {
    console.log(`PASS - initialDinh: ${initialDinh}, roundDinh: ${roundDinh}`);
} else {
    console.log(`FAIL - initialDinh: ${initialDinh}, roundDinh: ${roundDinh}`);
}
