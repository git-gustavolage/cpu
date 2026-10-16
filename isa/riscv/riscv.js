// RV32I + extensão M (subconjunto): encoder/decoder dos formatos R e I.
// 32 registradores de 32 bits (x0..x31); x0 é sempre 0.

import { ABI_NAMES, FORMAT, OPCODE, RISCV_INSTRUCTIONS } from "./constants.js";

const OPCODE_FORMAT = new Map([
  [OPCODE.OP, FORMAT.R],
  [OPCODE.OPIMM, FORMAT.I],
  [OPCODE.LOAD, FORMAT.I],
  [OPCODE.STORE, FORMAT.S],
  [OPCODE.BRANCH, FORMAT.B],
  [OPCODE.JALR, FORMAT.I],
  [OPCODE.JAL, FORMAT.J],
  [OPCODE.LUI, FORMAT.U],
  [OPCODE.AUIPC, FORMAT.U],
  [OPCODE.SYSTEM, FORMAT.I],
  [OPCODE.MISCMEM, FORMAT.I],
]);

export const REGISTERS = Object.fromEntries([
  ...Array.from({ length: 32 }, (_, n) => [`x${n}`, n]),
  ...ABI_NAMES.map((name, n) => [name, n]),
  ["fp", 8],
]);

const bin = (n) => (n >>> 0).toString(2).padStart(32, "0");

// inteiro sem sinal de `bits` bits
function assertField(name, value, bits) {
  if (!Number.isInteger(value) || value < 0 || value >= 2 ** bits) {
    throw new RangeError(`${name} inválido: ${value} (esperado inteiro de ${bits} bits)`);
  }
}

// inteiro com sinal (complemento de dois) de `bits` bits
function assertSigned(name, value, bits) {
  const min = -(2 ** (bits - 1));
  const max = 2 ** (bits - 1) - 1;

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} inválido: ${value} (esperado inteiro entre ${min} e ${max})`);
  }
}

function checkRegister(r, name) {
  assertField(name, r, 5);
}

function signExtend(value, bits) {
  const shift = 32 - bits;
  return (value << shift) >> shift;
}

function toWord(binary) {
  if (!Number.isInteger(binary) || binary < -(2 ** 31) || binary > 2 ** 32 - 1) {
    throw new RangeError(`palavra de instrução inválida: ${binary}`);
  }
  return binary >>> 0;
}

function getDef(op, format) {
  const def = Object.hasOwn(RISCV_INSTRUCTIONS, op) ? RISCV_INSTRUCTIONS[op] : undefined;

  if (!def || def.type !== format) {
    throw new Error(`Instrução tipo ${format} desconhecida: ${op}`);
  }
  return def;
}

const R_LOOKUP = new Map(
  Object.entries(RISCV_INSTRUCTIONS)
    .filter(([, def]) => def.type === FORMAT.R)
    .map(([name, def]) => [`${def.opcode}:${def.funct3}:${def.funct7}`, name]),
);

const I_LOOKUP = new Map();
for (const [name, def] of Object.entries(RISCV_INSTRUCTIONS)) {
  if (def.type !== FORMAT.I) {
    continue;
  }

  const key = `${def.opcode}:${def.funct3}`;

  if (!I_LOOKUP.has(key)) {
    I_LOOKUP.set(key, []);
  }

  I_LOOKUP.get(key).push([name, def]);
}

export class RiscvDecoded {
  constructor({ raw, op, format, rd = null, rs1 = null, rs2 = null, imm = null }) {
    this.raw = raw;
    this.op = op;
    this.format = format;
    this.rd = rd;
    this.rs1 = rs1;
    this.rs2 = rs2;
    this.imm = imm;
    Object.freeze(this);
  }
}

export class Decoder {
  decode(binary) {
    const word = toWord(binary);
    const opcode = word & 0x7f;
    const format = OPCODE_FORMAT.get(opcode);

    switch (format) {
      case FORMAT.R:
        return this.rTypeDecode(word);
      case FORMAT.I:
        return this.iTypeDecode(word);
      case undefined:
        throw new Error(`Opcode desconhecido: ${opcode.toString(2)}`);
      default:
        throw new Error(`Formato ${format} ainda não implementado`);
    }
  }

  iTypeDecode(binary) {
    const word = toWord(binary);

    const opcode = word & 0x7f;
    const rd = (word >>> 7) & 0x1f;
    const funct3 = (word >>> 12) & 0x7;
    const rs1 = (word >>> 15) & 0x1f;
    const funct7 = word >>> 25;
    const imm12 = word >>> 20;

    const candidates = I_LOOKUP.get(`${opcode}:${funct3}`) ?? [];

    const found = candidates.find(([, def]) => {
      if (def.shift) {
        return def.funct7 === funct7;
      }

      if (def.fixedImm !== undefined) {
        return def.fixedImm === imm12 && rd === 0 && rs1 === 0;
      }

      return true;
    });

    if (!found) {
      throw new Error(
        `Instrução tipo I desconhecida: opcode ${opcode.toString(2)}, funct3 ${funct3.toString(2)}, palavra 0x${word.toString(16).padStart(8, "0")}`,
      );
    }

    const [op, def] = found;
    const imm = def.shift ? (word >>> 20) & 0x1f : signExtend(imm12, 12);

    return new RiscvDecoded({ raw: bin(word), op, format: FORMAT.I, rd, rs1, imm });
  }

  rTypeDecode(binary) {
    const word = toWord(binary);

    const opcode = word & 0x7f;
    const rd = (word >>> 7) & 0x1f;
    const funct3 = (word >>> 12) & 0x7;
    const rs1 = (word >>> 15) & 0x1f;
    const rs2 = (word >>> 20) & 0x1f;
    const funct7 = word >>> 25;

    const op = R_LOOKUP.get(`${opcode}:${funct3}:${funct7}`);

    if (!op) {
      throw new Error(`Opcode/funct3/funct7 desconhecido: ${opcode.toString(2)}/${funct3.toString(2)}/${funct7.toString(2)}`);
    }

    return new RiscvDecoded({ raw: bin(word), op, format: FORMAT.R, rd, rs1, rs2 });
  }
}

export class Encoder {
  iType({ op, rd, rs1, imm }) {
    const def = getDef(op, FORMAT.I);

    // ECALL/EBREAK: sem operandos, imm é fixo
    if (def.fixedImm !== undefined) {
      rd ??= 0;
      rs1 ??= 0;
      imm ??= def.fixedImm;

      if (rd !== 0 || rs1 !== 0 || imm !== def.fixedImm) {
        throw new Error(`${op} não aceita operandos`);
      }
    }

    checkRegister(rd, "rd");
    checkRegister(rs1, "rs1");

    // bits 31:20
    let upper;
    if (def.shift) {
      assertField("shamt", imm, 5); // RV32: 0..31
      upper = (def.funct7 << 5) | imm;
    } else {
      assertSigned("imm", imm, 12);
      upper = imm & 0xfff;
    }

    const word = (upper << 20) | (rs1 << 15) | (def.funct3 << 12) | (rd << 7) | def.opcode;

    return word >>> 0;
  }

  rType({ op, rd, rs1, rs2 }) {
    const def = getDef(op, FORMAT.R);

    checkRegister(rd, "rd");
    checkRegister(rs1, "rs1");
    checkRegister(rs2, "rs2");

    const word = (def.funct7 << 25) | (rs2 << 20) | (rs1 << 15) | (def.funct3 << 12) | (rd << 7) | def.opcode;

    return word >>> 0;
  }
}
