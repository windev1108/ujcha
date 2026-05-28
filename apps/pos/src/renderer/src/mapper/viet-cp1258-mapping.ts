/**
 * Vietnamese CP1258 decomposed encoder cho máy in nhiệt ESC/POS
 *
 * CP1258 biểu diễn tiếng Việt bằng 2 bytes:
 *   BASE CHAR + COMBINING MARK
 *
 * Ví dụ:
 *   "ầ" → â (0xE2) + combining grave (0xCC)  = 2 bytes
 *   "ộ" → ô (0xF4) + combining dot below (0xF2) = 2 bytes
 *   "đ" → 0xF0  = 1 byte (không có combining)
 */

// CP1258 combining marks
const GRAVE = 0xcc  // huyền  (`)
const ACUTE = 0xec  // sắc    (´)
const TILDE = 0xde  // ngã    (~)
const HOOK = 0xd2  // hỏi    (?)
const DOT_BELOW = 0xf2  // nặng   (.)

interface D { b: number; c?: number }  // base, combining?

const MAP: Record<number, D> = {
    // ── a, â, ă ──────────────────────────────────────────────────────────────
    0x00e0: { b: 0xe0 },              // à
    0x00e1: { b: 0xe1 },              // á
    0x00e2: { b: 0xe2 },              // â
    0x0103: { b: 0xe3 },              // ă
    0x1ea0: { b: 0x61, c: DOT_BELOW },  // ạ
    0x1ea1: { b: 0x61, c: DOT_BELOW },  // ạ
    0x1ea2: { b: 0x61, c: HOOK },       // ả
    0x1ea3: { b: 0x61, c: HOOK },       // ả
    0x1ea4: { b: 0xc2, c: ACUTE },      // Ấ
    0x1ea5: { b: 0xe2, c: ACUTE },      // ấ
    0x1ea6: { b: 0xc2, c: GRAVE },      // Ầ
    0x1ea7: { b: 0xe2, c: GRAVE },      // ầ
    0x1ea8: { b: 0xc2, c: HOOK },       // Ẩ
    0x1ea9: { b: 0xe2, c: HOOK },       // ẩ
    0x1eaa: { b: 0xc2, c: TILDE },      // Ẫ
    0x1eab: { b: 0xe2, c: TILDE },      // ẫ
    0x1eac: { b: 0xc2, c: DOT_BELOW },  // Ậ
    0x1ead: { b: 0xe2, c: DOT_BELOW },  // ậ
    0x1eae: { b: 0xc3, c: ACUTE },      // Ắ
    0x1eaf: { b: 0xe3, c: ACUTE },      // ắ
    0x1eb0: { b: 0xc3, c: GRAVE },      // Ằ
    0x1eb1: { b: 0xe3, c: GRAVE },      // ằ
    0x1eb2: { b: 0xc3, c: HOOK },       // Ẳ
    0x1eb3: { b: 0xe3, c: HOOK },       // ẳ
    0x1eb4: { b: 0xc3, c: TILDE },      // Ẵ
    0x1eb5: { b: 0xe3, c: TILDE },      // ẵ
    0x1eb6: { b: 0xc3, c: DOT_BELOW },  // Ặ
    0x1eb7: { b: 0xe3, c: DOT_BELOW },  // ặ
    // ── e, ê ─────────────────────────────────────────────────────────────────
    0x00e8: { b: 0xe8 },              // è
    0x00e9: { b: 0xe9 },              // é
    0x00ea: { b: 0xea },              // ê
    0x1eb8: { b: 0x45, c: DOT_BELOW },  // Ẹ
    0x1eb9: { b: 0x65, c: DOT_BELOW },  // ẹ
    0x1eba: { b: 0x45, c: HOOK },       // Ẻ
    0x1ebb: { b: 0x65, c: HOOK },       // ẻ
    0x1ebc: { b: 0x45, c: TILDE },      // Ẽ
    0x1ebd: { b: 0x65, c: TILDE },      // ẽ
    0x1ebe: { b: 0xca, c: ACUTE },      // Ế
    0x1ebf: { b: 0xea, c: ACUTE },      // ế
    0x1ec0: { b: 0xca, c: GRAVE },      // Ề
    0x1ec1: { b: 0xea, c: GRAVE },      // ề
    0x1ec2: { b: 0xca, c: HOOK },       // Ể
    0x1ec3: { b: 0xea, c: HOOK },       // ể
    0x1ec4: { b: 0xca, c: TILDE },      // Ễ
    0x1ec5: { b: 0xea, c: TILDE },      // ễ
    0x1ec6: { b: 0xca, c: DOT_BELOW },  // Ệ
    0x1ec7: { b: 0xea, c: DOT_BELOW },  // ệ
    // ── i ────────────────────────────────────────────────────────────────────
    0x00ec: { b: 0xec },              // ì
    0x00ed: { b: 0xed },              // í
    0x1ec8: { b: 0x49, c: HOOK },       // Ỉ
    0x1ec9: { b: 0x69, c: HOOK },       // ỉ
    0x1eca: { b: 0x49, c: DOT_BELOW },  // Ị
    0x1ecb: { b: 0x69, c: DOT_BELOW },  // ị
    // ── o, ô, ơ ──────────────────────────────────────────────────────────────
    0x00f2: { b: 0xf2 },              // ò
    0x00f3: { b: 0xf3 },              // ó
    0x00f4: { b: 0xf4 },              // ô
    0x01a1: { b: 0xf5 },              // ơ
    0x1ecc: { b: 0x4f, c: DOT_BELOW },  // Ọ
    0x1ecd: { b: 0x6f, c: DOT_BELOW },  // ọ
    0x1ece: { b: 0x4f, c: HOOK },       // Ỏ
    0x1ecf: { b: 0x6f, c: HOOK },       // ỏ
    0x1ed0: { b: 0xd4, c: ACUTE },      // Ố
    0x1ed1: { b: 0xf4, c: ACUTE },      // ố
    0x1ed2: { b: 0xd4, c: GRAVE },      // Ồ
    0x1ed3: { b: 0xf4, c: GRAVE },      // ồ
    0x1ed4: { b: 0xd4, c: HOOK },       // Ổ
    0x1ed5: { b: 0xf4, c: HOOK },       // ổ
    0x1ed6: { b: 0xd4, c: TILDE },      // Ỗ
    0x1ed7: { b: 0xf4, c: TILDE },      // ỗ
    0x1ed8: { b: 0xd4, c: DOT_BELOW },  // Ộ
    0x1ed9: { b: 0xf4, c: DOT_BELOW },  // ộ
    0x1eda: { b: 0xd5, c: ACUTE },      // Ớ
    0x1edb: { b: 0xf5, c: ACUTE },      // ớ
    0x1edc: { b: 0xd5, c: GRAVE },      // Ờ
    0x1edd: { b: 0xf5, c: GRAVE },      // ờ
    0x1ede: { b: 0xd5, c: HOOK },       // Ở
    0x1edf: { b: 0xf5, c: HOOK },       // ở
    0x1ee0: { b: 0xd5, c: TILDE },      // Ỡ
    0x1ee1: { b: 0xf5, c: TILDE },      // ỡ
    0x1ee2: { b: 0xd5, c: DOT_BELOW },  // Ợ
    0x1ee3: { b: 0xf5, c: DOT_BELOW },  // ợ
    // ── u, ư ─────────────────────────────────────────────────────────────────
    0x00f9: { b: 0xf9 },              // ù
    0x00fa: { b: 0xfa },              // ú
    0x01b0: { b: 0xfd },              // ư
    0x1ee4: { b: 0x55, c: DOT_BELOW },  // Ụ
    0x1ee5: { b: 0x75, c: DOT_BELOW },  // ụ
    0x1ee6: { b: 0x55, c: HOOK },       // Ủ
    0x1ee7: { b: 0x75, c: HOOK },       // ủ
    0x1ee8: { b: 0xdd, c: ACUTE },      // Ứ
    0x1ee9: { b: 0xfd, c: ACUTE },      // ứ
    0x1eea: { b: 0xdd, c: GRAVE },      // Ừ
    0x1eeb: { b: 0xfd, c: GRAVE },      // ừ
    0x1eec: { b: 0xdd, c: HOOK },       // Ử
    0x1eed: { b: 0xfd, c: HOOK },       // ử
    0x1eee: { b: 0xdd, c: TILDE },      // Ữ
    0x1eef: { b: 0xfd, c: TILDE },      // ữ
    0x1ef0: { b: 0xdd, c: DOT_BELOW },  // Ự
    0x1ef1: { b: 0xfd, c: DOT_BELOW },  // ự
    // ── y ────────────────────────────────────────────────────────────────────
    0x00fd: { b: 0xfd },              // ý
    0x1ef2: { b: 0x59, c: GRAVE },      // Ỳ
    0x1ef3: { b: 0x79, c: GRAVE },      // ỳ
    0x1ef4: { b: 0x59, c: DOT_BELOW },  // Ỵ
    0x1ef5: { b: 0x79, c: DOT_BELOW },  // ỵ
    0x1ef6: { b: 0x59, c: HOOK },       // Ỷ
    0x1ef7: { b: 0x79, c: HOOK },       // ỷ
    0x1ef8: { b: 0x59, c: TILDE },      // Ỹ
    0x1ef9: { b: 0x79, c: TILDE },      // ỹ
    // ── đ, Đ ─────────────────────────────────────────────────────────────────
    0x0111: { b: 0xf0 },              // đ
    0x0110: { b: 0xd0 },              // Đ
    // ── Chữ hoa ──────────────────────────────────────────────────────────────
    0x00c0: { b: 0xc0 },              // À
    0x00c1: { b: 0xc1 },              // Á
    0x00c2: { b: 0xc2 },              // Â
    0x0102: { b: 0xc3 },              // Ă
    0x00c8: { b: 0xc8 },              // È
    0x00c9: { b: 0xc9 },              // É
    0x00ca: { b: 0xca },              // Ê
    0x00cc: { b: 0xcc },              // Ì
    0x00cd: { b: 0xcd },              // Í
    0x00d2: { b: 0xd2 },              // Ò
    0x00d3: { b: 0xd3 },              // Ó
    0x00d4: { b: 0xd4 },              // Ô
    0x01a0: { b: 0xd5 },              // Ơ
    0x00d9: { b: 0xd9 },              // Ù
    0x00da: { b: 0xda },              // Ú
    0x01af: { b: 0xdd },              // Ư
    // ── Ký tự đặc biệt ───────────────────────────────────────────────────────
    0x20ab: { b: 0xfe },              // ₫ đồng
}

export function encodeCP1258(text: string): Buffer {
    const bytes: number[] = []
    for (const char of text) {
        const cp = char.codePointAt(0)!
        if (cp <= 0x7f) {
            bytes.push(cp)
            continue
        }
        const entry = MAP[cp]
        if (entry) {
            bytes.push(entry.b)
            if (entry.c !== undefined) bytes.push(entry.c)
            continue
        }
        // Fallback: bỏ dấu về ASCII
        const stripped = char
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[đĐ]/g, c => c === 'đ' ? 'd' : 'D')
        const fb = stripped.codePointAt(0)
        bytes.push(fb !== undefined && fb <= 0x7f ? fb : 0x3f)
    }
    return Buffer.from(bytes)
}

export function cp1258ln(text: string): Buffer {
    return Buffer.concat([encodeCP1258(text), Buffer.from([0x0a])])
}