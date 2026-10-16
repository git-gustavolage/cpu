// formatos das instruções
// informam como o decoder deve "fatiar" o restante da instrução
export const FORMAT = {
  R: "R",
  I: "I",
  S: "S",
  U: "U",
  B: "B",
  J: "J",
};

// opcodes: 7 bits menos significativos da instrução.
// O opcode determina o FORMATO (e a classe da instrução), mas não a instrução:
// quem identifica a instrução é opcode + funct3 (+ funct7, ou o imm em ECALL/EBREAK).
export const OPCODE = {
  OP: 0b0110011, // R
  OPIMM: 0b0010011, // I
  LOAD: 0b0000011, // I
  STORE: 0b0100011, // S
  BRANCH: 0b1100011, // B
  JALR: 0b1100111, // I
  JAL: 0b1101111, // J
  LUI: 0b0110111, // U
  AUIPC: 0b0010111, // U
  SYSTEM: 0b1110011, // I
  MISCMEM: 0b0001111, // I
};

const r = (funct3, funct7) => ({
  type: FORMAT.R,
  opcode: OPCODE.OP,
  funct3,
  funct7,
});

// Campos extras opcionais no formato I:
//   shift: true     -> shift imediato: bits 31:25 = funct7, imm = shamt (5 bits, 0..31)
//   fixedImm: N     -> imm fixo (ECALL/EBREAK); rd e rs1 devem ser 0
const i = (opcode, funct3, extra = {}) => ({
  type: FORMAT.I,
  opcode,
  funct3,
  ...extra,
});

export const RISCV_INSTRUCTIONS = {
  // OP (opcode 0110011): RV32I, formato R
  ADD: r(0b000, 0b0000000), // Add
  SUB: r(0b000, 0b0100000), // Subtract
  SLL: r(0b001, 0b0000000), // Shift Left Logical
  SLT: r(0b010, 0b0000000), // Set Less Than (signed)
  SLTU: r(0b011, 0b0000000), // Set Less Than (unsigned)
  XOR: r(0b100, 0b0000000), // Exclusive OR
  SRL: r(0b101, 0b0000000), // Shift Right Logical
  SRA: r(0b101, 0b0100000), // Shift Right Arithmetic
  OR: r(0b110, 0b0000000), // OR
  AND: r(0b111, 0b0000000), // AND

  // OP (opcode 0110011): extensão M, formato R, funct7 = 0000001
  MUL: r(0b000, 0b0000001), // Multiply (32 bits baixos)
  MULH: r(0b001, 0b0000001), // Multiply High (signed × signed)
  MULHSU: r(0b010, 0b0000001), // Multiply High (signed × unsigned)
  MULHU: r(0b011, 0b0000001), // Multiply High (unsigned × unsigned)
  DIV: r(0b100, 0b0000001), // Divide (signed)
  DIVU: r(0b101, 0b0000001), // Divide (unsigned)
  REM: r(0b110, 0b0000001), // Remainder (signed)
  REMU: r(0b111, 0b0000001), // Remainder (unsigned)

  // OP-IMM (opcode 0010011): formato I
  ADDI: i(OPCODE.OPIMM, 0b000), // Add Immediate
  SLTI: i(OPCODE.OPIMM, 0b010), // Set Less Than Immediate (signed)
  SLTIU: i(OPCODE.OPIMM, 0b011), // Set Less Than Immediate (unsigned)
  XORI: i(OPCODE.OPIMM, 0b100), // XOR Immediate
  ORI: i(OPCODE.OPIMM, 0b110), // OR Immediate
  ANDI: i(OPCODE.OPIMM, 0b111), // AND Immediate

  // OP-IMM: shifts imediatos (formato I, mas com funct7 + shamt no lugar do imm)
  SLLI: i(OPCODE.OPIMM, 0b001, { shift: true, funct7: 0b0000000 }), // Shift Left Logical Immediate
  SRLI: i(OPCODE.OPIMM, 0b101, { shift: true, funct7: 0b0000000 }), // Shift Right Logical Immediate
  SRAI: i(OPCODE.OPIMM, 0b101, { shift: true, funct7: 0b0100000 }), // Shift Right Arithmetic Immediate

  // LOAD (opcode 0000011): formato I
  LB: i(OPCODE.LOAD, 0b000), // Load Byte
  LH: i(OPCODE.LOAD, 0b001), // Load Halfword
  LW: i(OPCODE.LOAD, 0b010), // Load Word
  LBU: i(OPCODE.LOAD, 0b100), // Load Byte (unsigned)
  LHU: i(OPCODE.LOAD, 0b101), // Load Halfword (unsigned)

  // JALR (opcode 1100111): formato I
  JALR: i(OPCODE.JALR, 0b000), // Jump And Link Register

  // SYSTEM (opcode 1110011): formato I, funct3 = 000, imm fixo
  ECALL: i(OPCODE.SYSTEM, 0b000, { fixedImm: 0 }), // Environment Call
  EBREAK: i(OPCODE.SYSTEM, 0b000, { fixedImm: 1 }), // Environment Break
};

// x0..x31 + nomes ABI (zero, ra, sp, ..., a0-a7, s0-s11, t0-t6) + fp (alias de s0)
export const ABI_NAMES = [
  "zero",
  "ra",
  "sp",
  "gp",
  "tp",
  "t0",
  "t1",
  "t2",
  "s0",
  "s1",
  "a0",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "a6",
  "a7",
  "s2",
  "s3",
  "s4",
  "s5",
  "s6",
  "s7",
  "s8",
  "s9",
  "s10",
  "s11",
  "t3",
  "t4",
  "t5",
  "t6",
];
