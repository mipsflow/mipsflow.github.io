// Free-form code tracer: parse MIPS code, simulate it and draw the pipeline timeline.
import { fitsSigned16, parseImmediate } from '../simulator/encoding/immediate.js';
import { forwardingSelect } from '../simulator/pipeline/forwarding.js';
import { schedulePipeline } from '../simulator/pipeline/timing.js';

const $ = (id) => document.getElementById(id),
    put = (id, v) => {
      const e = $(id);
      if (e) e.textContent = v;
    };
  const rr = {
    zero: 0,
    at: 1,
    v0: 2,
    v1: 3,
    a0: 4,
    a1: 5,
    a2: 6,
    a3: 7,
    t0: 8,
    t1: 9,
    t2: 10,
    t3: 11,
    t4: 12,
    t5: 13,
    t6: 14,
    t7: 15,
    s0: 16,
    s1: 17,
    s2: 18,
    s3: 19,
    s4: 20,
    s5: 21,
    s6: 22,
    s7: 23,
    t8: 24,
    t9: 25,
    k0: 26,
    k1: 27,
    gp: 28,
    sp: 29,
    fp: 30,
    s8: 30,
    ra: 31,
  };
  for (let i = 0; i < 32; i++) rr[i] = i;
  const name = (n) =>
      ({
        8: 't0',
        9: 't1',
        10: 't2',
        11: 't3',
        12: 't4',
        13: 't5',
        14: 't6',
        15: 't7',
        16: 's0',
        17: 's1',
        18: 's2',
        19: 's3',
        20: 's4',
        21: 's5',
        22: 's6',
        23: 's7',
        0: 'zero',
      })[n] || n,
    esc = (s) =>
      String(s).replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
      );
  function parse(src) {
    let pc = 0x00400000;
    const raw = [],
      labels = {};
    src.split(/\r?\n/).forEach((line, index) => {
      let text = line.replace(/#.*$/, '').trim();
      if (!text) return;
      const label = text.match(/^([\w.$]+):/);
      if (label) {
        labels[label[1].toLowerCase()] = pc;
        text = text.slice(label[0].length).trim();
        if (!text) return;
      }
      raw.push({ s: text, line: index + 1, pc });
      pc += 4;
    });
    const reg = (token, line) => {
      const key = token.replace(/^\$/, '').toLowerCase();
      if (!Object.hasOwn(rr, key)) throw Error(`שורה ${line}: אוגר לא מוכר ${token}`);
      return rr[key];
    };
    return raw.map((item) => {
      const parts = item.s.replace(/,/g, ' ').replace(/[()]/g, ' ').trim().split(/\s+/),
        op = parts.shift().toLowerCase(),
        q = { ...item, op, rs: 0, rt: 0, rd: 0, imm: 0, reads: [], wr: null };
      const immediate = (token) => {
        const value = parseImmediate(token);
        if (!fitsSigned16(value)) throw Error(`שורה ${item.line}: immediate מחוץ לטווח 16-bit`);
        return value;
      };
      if (['add', 'sub', 'and', 'or', 'slt'].includes(op)) {
        if (parts.length !== 3) throw Error(`שורה ${item.line}: תחביר לא תקין`);
        q.rd = reg(parts[0], item.line);
        q.rs = reg(parts[1], item.line);
        q.rt = reg(parts[2], item.line);
        q.reads = [q.rs, q.rt];
        q.wr = q.rd;
      } else if (op === 'addi') {
        if (parts.length !== 3) throw Error(`שורה ${item.line}: תחביר לא תקין`);
        q.rt = reg(parts[0], item.line);
        q.rs = reg(parts[1], item.line);
        q.imm = immediate(parts[2]);
        q.reads = [q.rs];
        q.wr = q.rt;
      } else if (['lw', 'sw'].includes(op)) {
        if (parts.length !== 3) throw Error(`שורה ${item.line}: תחביר לא תקין`);
        q.rt = reg(parts[0], item.line);
        q.imm = immediate(parts[1]);
        q.rs = reg(parts[2], item.line);
        q.reads = op === 'lw' ? [q.rs] : [q.rs, q.rt];
        if (op === 'lw') q.wr = q.rt;
      } else if (['beq', 'bne'].includes(op)) {
        if (parts.length !== 3) throw Error(`שורה ${item.line}: תחביר לא תקין`);
        q.rs = reg(parts[0], item.line);
        q.rt = reg(parts[1], item.line);
        q.reads = [q.rs, q.rt];
        q.target =
          labels[parts[2].toLowerCase()] ??
          (!Number.isNaN(parseImmediate(parts[2])) ? item.pc + 4 + (immediate(parts[2]) << 2) : null);
        if (q.target === null) throw Error(`שורה ${item.line}: יעד branch לא קיים`);
        q.imm = (q.target - (item.pc + 4)) / 4;
        if (!Number.isInteger(q.imm) || q.imm < -32768 || q.imm > 32767)
          throw Error(`שורה ${item.line}: יעד branch מחוץ לטווח`);
      } else if (op === 'j') {
        if (parts.length !== 1) throw Error(`שורה ${item.line}: תחביר לא תקין`);
        q.target = labels[parts[0].toLowerCase()] ?? Number(parts[0]);
        if (!Number.isInteger(q.target) || q.target < 0) throw Error(`שורה ${item.line}: יעד j לא תקין`);
      } else if (op !== 'nop') throw Error(`שורה ${item.line}: ${op} לא נתמכת`);
      return q;
    });
  }
  function code(q) {
    let f = { add: 32, sub: 34, and: 36, or: 37, slt: 42 }[q.op],
      o = { addi: 8, lw: 35, sw: 43, beq: 4, bne: 5 }[q.op],
      n = 0;
    if (f) n = (q.rs << 21) | (q.rt << 16) | (q.rd << 11) | f;
    else if (o !== undefined) n = (o << 26) | (q.rs << 21) | (q.rt << 16) | (q.imm & 65535);
    else if (q.op === 'j') n = (2 << 26) | ((q.target >>> 2) & 0x3ffffff);
    return '0x' + (n >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }
  function draw(q) {
    const c =
      {
        add: {
          RegDst: 1,
          ALUSrc: 0,
          MemtoReg: 0,
          RegWrite: 1,
          MemRead: 0,
          MemWrite: 0,
          Branch: 0,
          ALUOp1: 1,
          ALUOp0: 0,
          Jump: 0,
        },
        addi: {
          RegDst: 0,
          ALUSrc: 1,
          MemtoReg: 0,
          RegWrite: 1,
          MemRead: 0,
          MemWrite: 0,
          Branch: 0,
          ALUOp1: 0,
          ALUOp0: 0,
          Jump: 0,
        },
        lw: {
          RegDst: 0,
          ALUSrc: 1,
          MemtoReg: 1,
          RegWrite: 1,
          MemRead: 1,
          MemWrite: 0,
          Branch: 0,
          ALUOp1: 0,
          ALUOp0: 0,
          Jump: 0,
        },
        sw: { ALUSrc: 1, RegWrite: 0, MemRead: 0, MemWrite: 1, Branch: 0, ALUOp1: 0, ALUOp0: 0, Jump: 0 },
        beq: { ALUSrc: 0, RegWrite: 0, MemRead: 0, MemWrite: 0, Branch: 1, ALUOp1: 0, ALUOp0: 1, Jump: 0 },
        j: { RegWrite: 0, MemRead: 0, MemWrite: 0, Jump: 1 },
      }[q.name] || {};
    put('latch-ifid-1', 'PC=0x00400000 · PC+4=0x00400004');
    put(
      'latch-ifid-2',
      `Instr[31:0]=${(window.routeInfo?.[q.name]?.[1].match(/0x[\da-f]+/i) || [])[0] || 'קידוד הפקודה'} · opcode · rs · rt · rd/imm`,
    );
    put(
      'latch-idex-1',
      `ReadData1=7 · ReadData2=5 · imm=${['addi', 'lw', 'sw', 'beq'].includes(q.name) ? '8' : '—'}`,
    );
    put('latch-idex-2', `rs=9 · rt=10 · rd=8 · funct=${q.name === 'add' ? '0x20' : 'לפי הפקודה'}`);
    put(
      'latch-idex-3',
      `WB: RegWrite=${c.RegWrite} · MemtoReg=${c.MemtoReg ?? 'X'} | M: MemRead=${c.MemRead} · MemWrite=${c.MemWrite} · Branch=${c.Branch} | EX: RegDst=${c.RegDst ?? 'X'} · ALUSrc=${c.ALUSrc ?? 'X'} · ALUOp=${c.ALUOp1 ?? 'X'}${c.ALUOp0 ?? 'X'}`,
    );
    put(
      'latch-exmem-1',
      `ALUResult=${q.name === 'lw' || q.name === 'sw' ? '104' : q.name === 'addi' ? '15' : q.name === 'beq' ? '0' : '12'} · Zero=${q.name === 'beq' ? '1' : '0'} · BranchTarget=${q.name === 'beq' ? '0x00400010' : '—'}`,
    );
    put(
      'latch-exmem-2',
      `WriteData=${q.name === 'sw' ? '5' : '—'} · WriteReg=${c.RegDst === 1 ? 'rd=8' : c.RegDst === 0 ? 'rt=10' : '—'}`,
    );
    put(
      'latch-exmem-3',
      `WB: RegWrite=${c.RegWrite} · MemtoReg=${c.MemtoReg ?? 'X'} | M: MemRead=${c.MemRead} · MemWrite=${c.MemWrite}`,
    );
    put(
      'latch-memwb-1',
      `ReadData=${q.name === 'lw' ? '42' : '—'} · ALUResult=${q.name === 'addi' ? '15' : '12'}`,
    );
    put(
      'latch-memwb-2',
      `WriteReg=${c.RegDst === 1 ? 'R8' : 'R10'} · WriteData=${q.name === 'lw' ? '42' : q.name === 'addi' ? '15' : '12'}`,
    );
    put('latch-memwb-3', `WB: RegWrite=${c.RegWrite} · MemtoReg=${c.MemtoReg ?? 'X'}`);
    put('pipe-alusrc-value', `${c.ALUSrc ?? 'X'} · ${c.ALUSrc === 1 ? 'imm=8' : 'B=ReadData2=5'}`);
    put(
      'pipe-regdst-value',
      `${c.RegDst ?? 'X'} · ${c.RegDst === 1 ? 'rd=8' : c.RegDst === 0 ? 'rt=10' : '—'}`,
    );
    put(
      'pipe-branch-value',
      `Branch=${c.Branch ?? 0} · Zero=${q.name === 'beq' ? 1 : 0} · Branch AND Zero=${q.name === 'beq' ? 1 : 0}`,
    );
    put(
      'pipe-pcsrc-value',
      `PCSrc=${q.name === 'beq' ? 1 : 0} · ${q.name === 'beq' ? 'BranchTarget' : 'PC+4'}`,
    );
    put('pipe-jump-value', `Jump=${c.Jump ?? 0} · יעד=${q.name === 'j' ? '0x00000400' : '—'}`);
  }
  function schedule(rows) {
    const result = schedulePipeline(rows),
      n = result.cycles;
    const cellClass = (value) =>
      value === 'IF'
        ? 'stage-if'
        : value === 'ID'
          ? 'stage-id'
          : value === 'EX'
            ? 'stage-ex'
            : value === 'MEM'
              ? 'stage-mem'
              : value === 'WB'
                ? 'stage-wb'
                : value === 'Flush'
                  ? 'flushed'
                  : value.includes('המתנה')
                    ? 'stalled'
                    : '';
    const header =
      '<table class="sequence-table" dir="ltr"><thead><tr><th dir="rtl">פקודה</th>' +
      Array.from({ length: n }, (_, i) => `<th>מחזור ${i + 1}</th>`).join('') +
      '</tr></thead><tbody>';
    let body = '';
    result.rows.forEach((row, rowIndex) => {
      body += `<tr><th dir="rtl">${esc(row.q.s)}${row.flush ? ' · Flush' : ''}</th>`;
      for (let c = 1; c <= n; c++) {
        const value = row.cells[c] || '·';
        body += `<td class="${cellClass(value)}">${value}</td>`;
      }
      body += '</tr>';
    });
    result.bubbles.forEach((bubble) => {
      body += '<tr class="bubble-row"><th dir="rtl">בועה · NOP</th>';
      for (let c = 1; c <= n; c++)
        body += `<td class="${c === bubble.cycle ? 'bubble' : ''}">${c === bubble.cycle ? bubble.label : '·'}</td>`;
      body += '</tr>';
    });
    return header + body + '</tbody></table>';
  }
  function track() {
    const status = $('program-status'),
      detail = $('program-detail');
    try {
      const qs = parse($('pipeline-code').value);
      if (!qs.length) throw Error('כתבי לפחות פקודה אחת.');
      const registers = Array(32).fill(0),
        memory = { 104: 42, 108: 99 };
      registers[8] = 0;
      registers[9] = 7;
      registers[10] = 5;
      registers[16] = 100;
      registers[17] = 2;
      const pcIndex = new Map(qs.map((q, i) => [q.pc, i])),
        rows = [],
        warnings = [];
      let index = 0,
        executed = 0;
      const regValue = (n) => registers[n] || 0,
        w32 = (v) => v | 0,
        num = (v) =>
          v < 0 ? `${v} (0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')})` : String(v);
      while (index >= 0 && index < qs.length && executed < 100) {
        const q = qs[index],
          a = regValue(q.rs),
          b = regValue(q.rt);
        let alu = '—',
          mem = 'לא בשימוש',
          wb = 'אין כתיבה',
          value = 0,
          taken = false;
        if (['add', 'sub', 'and', 'or', 'slt'].includes(q.op)) {
          value = w32({ add: a + b, sub: a - b, and: a & b, or: a | b, slt: +(a < b) }[q.op]);
          alu = `${q.op}: ${a}, ${b} → ${num(value)}`;
          wb = q.rd ? `${num(value)} → $${name(q.rd)}` : `$zero לא משתנה (נשאר 0)`;
          if (q.rd) registers[q.rd] = value;
        } else if (q.op === 'addi') {
          value = w32(a + q.imm);
          alu = `${a} + ${q.imm} → ${num(value)}`;
          wb = q.rt ? `${num(value)} → $${name(q.rt)}` : `$zero לא משתנה (נשאר 0)`;
          if (q.rt) registers[q.rt] = value;
        } else if (q.op === 'lw' || q.op === 'sw') {
          value = w32(a + q.imm);
          const badAddress = value < 0 || value % 4 !== 0;
          if (badAddress)
            warnings.push(
              `שורה ${q.line}: הכתובת ${value} אינה חוקית (כתובת מילה חייבת להיות חיובית ולהתחלק ב־4). המעקב ממשיך כדי להראות את התזמון.`,
            );
          alu = `כתובת = \u200E${a} + ${q.imm} = ${value}`;
          if (q.op === 'lw') {
            const known = !badAddress && Object.hasOwn(memory, value),
              loaded = known ? memory[value] : 0;
            mem = badAddress
              ? `⚠ \u200EM[${value}]\u200E: כתובת לא חוקית, מניחים 0`
              : known
                ? `M[${value}]=${loaded}`
                : `M[${value}] לא אותחל · מניחים 0`;
            wb = `${loaded} → $${name(q.rt)}`;
            if (q.rt) registers[q.rt] = loaded;
          } else if (badAddress) {
            mem = `⚠ \u200EM[${value}]\u200E: כתובת לא חוקית, לא נכתב`;
          } else {
            mem = `M[${value}] ← ${b}`;
            memory[value] = b;
          }
        } else if (q.op === 'beq' || q.op === 'bne') {
          taken = q.op === 'beq' ? a === b : a !== b;
          alu = `השוואה: ${a} − ${b} → Zero=${a === b ? 1 : 0}`;
          mem = taken ? `ענף נלקח → ${formatPc(q.target)}` : 'ענף לא נלקח';
        } else if (q.op === 'j') {
          taken = true;
          mem = `קפיצה → ${formatPc(q.target)}`;
        }
        const row = { q, a, b, alu, mem, wb, taken };
        rows.push(row);
        executed++;
        if (taken) {
          const targetIndex = pcIndex.get(q.target),
            wrong = qs[index + 1];
          if (wrong && wrong.pc !== q.target)
            rows.push({
              q: wrong,
              a: regValue(wrong.rs),
              b: regValue(wrong.rt),
              alu: 'בוטלה · IF.Flush=1',
              mem: 'לא מתבצעת',
              wb: 'אין כתיבה',
              flush: true,
            });
          if (targetIndex === undefined) break;
          index = targetIndex;
        } else index++;
      }
      if (executed >= 100) status.textContent = 'המעקב הוגבל ל־100 פקודות כדי למנוע לולאה אינסופית.';
      const timing = schedulePipeline(rows),
        scheduled = timing.rows;
      const writers = [];
      for (const row of scheduled) {
        if (row.flush) {
          row.raw = false;
          row.forwardA = '00';
          row.forwardB = '00';
          continue;
        }
        const reads = row.q.reads,
          prior = writers.filter((x) => reads.includes(x.q.wr));
        row.raw = prior.length > 0;
        const nearest = (register) => prior.filter((x) => x.q.wr === register).at(-1);
        const select = (register) => {
          const source = nearest(register);
          if (!source) return '00';
          const exMem =
            source.q.op !== 'lw' && source.cycles.EX + 1 === row.cycles.EX
              ? { regWrite: true, writeRegister: register }
              : null;
          const memWb =
            source.cycles.WB === row.cycles.EX ? { regWrite: true, writeRegister: register } : null;
          return forwardingSelect({ sourceRegister: register, exMem, memWb });
        };
        row.forwardA = select(row.q.rs);
        row.forwardB = select(row.q.rt);
        if (row.q.wr != null && row.q.wr !== 0) writers.push(row);
      }
      status.textContent = `${qs.length} שורות קוד · ${scheduled.filter((x) => x.raw).length} תלות RAW · ${timing.bubbles.length} בועות · מחזור ${timing.cycles} בסוף המעקב`;
      status.className = 'program-status';
      if (warnings.length) {
        status.textContent += ' · ⚠ ' + warnings.join(' ');
        status.className = 'program-status warning';
      }
      detail.innerHTML =
        '<b>מצב התחלתי:</b> <bdi dir="ltr">$t0(R8)=0, $t1(R9)=7, $t2(R10)=5, $s0(R16)=100, $s1(R17)=2; M[104]=42, M[108]=99.</bdi> כתובות מתחילות ב־<bdi dir="ltr">0x00400000</bdi>. Branch נבדק ב־ID; נתיב שגוי נשטף בשלב זה.';
      $('program-trace').innerHTML =
        '<table class="program-table"><thead><tr><th>פקודה / קידוד</th><th>IF</th><th>ID · אוגרים</th><th>EX · ALU</th><th>MEM</th><th>WB</th><th>בקרה וסיכון</th></tr></thead><tbody>' +
        scheduled
          .map((x) => {
            const q = x.q,
              pc = formatPc(q.pc),
              encoding = code(q),
              stall = x.stallCycles || 0,
              signals = `ForwardA=${x.forwardA ?? '00'}${x.raw ? ` · ForwardB=${x.forwardB}` : ''} · Stall=${stall} · PCWrite=${stall ? 0 : 1} · IF/IDWrite=${stall ? 0 : 1} · ID/EX.Flush=${stall ? 1 : 0}`;
            const fields = x.flush
              ? ['Flush · IF', 'בוטלה', '—', 'לא מתבצעת', 'אין כתיבה']
              : [
                  `<bdi dir="ltr">${pc} · ${encoding}</bdi>`,
                  `<bdi dir="ltr">rs=$${name(q.rs)}=${x.a} · rt=$${name(q.rt)}=${x.b}</bdi>${stall ? '<br>ממתינה ב־ID' : ''}`,
                  `<bdi dir="ltr">${esc(x.alu)}</bdi>`,
                  `<bdi dir="ltr">${esc(x.mem)}</bdi>`,
                  `<bdi dir="ltr">${esc(x.wb)}</bdi>`,
                ];
            const hazard = x.flush
              ? 'Flush · לא מגיעה לשלבים הבאים'
              : x.raw
                ? `RAW → ForwardA=${x.forwardA}, ForwardB=${x.forwardB} · ${stall ? `בועה ${stall}` : 'Forwarding'}`
                : 'אין RAW';
            return `<tr data-p-row="${scheduled.indexOf(x)}" class="${x.flush ? 'flushed' : ''}"><td><code dir="ltr">${esc(q.s)}</code><small dir="ltr">${encoding}</small></td>${fields.map((v) => `<td>${v}</td>`).join('')}<td>${hazard}<small dir="ltr">${signals}</small></td></tr>`;
          })
          .join('') +
        '</tbody></table>';
      $('program-schedule').innerHTML = schedule(scheduled);
      document.querySelectorAll('#program-trace tr[data-p-row]').forEach(
        (el) =>
          (el.onclick = () => {
            const x = scheduled[+el.dataset.pRow];
            if (!x) return;
            detail.innerHTML = `<bdi dir="ltr"><b>${esc(x.q.s)} · ${code(x.q)}</b></bdi><br>ID קורא <bdi dir="ltr">$${name(x.q.rs)}=${x.a}, $${name(x.q.rt)}=${x.b}</bdi>. EX: ${esc(x.alu)}. MEM: ${esc(x.mem)}. WB: ${esc(x.wb)}.<br>${x.flush ? 'הפקודה בוטלה ב־IF.Flush ואינה ממשיכה לצינור.' : x.stallCycles ? `RAW: המתנה ${x.stallCycles} מחזור/ים; PC ו־IF/ID נעצרים וה־ID/EX מקבל NOP.` : x.raw ? `RAW: ForwardA=${x.forwardA}, ForwardB=${x.forwardB} מעבירים את הערך הזמין אל ה־ALU.` : 'אין תלות RAW.'}`;
          }),
      );
      document.querySelectorAll('#program-trace tr').forEach((tr) =>
        tr.querySelectorAll('td').forEach((td, ci) => {
          if (ci >= 1 && ci <= 5) {
            td.style.cursor = 'pointer';
            td.title = 'לחצי כדי לבחור שלב בתרשים';
            td.addEventListener('click', () => {
              document.querySelector('[data-pipe-panel=diagram]')?.click();
              const op = tr.querySelector('code')?.textContent.trim().split(/\s+/)[0].toLowerCase(),
                alias = { sub: 'add', and: 'add', or: 'add', slt: 'add', bne: 'beq', nop: 'add' }[op] || op,
                choice = [...document.querySelectorAll('[data-pipe-instruction]')].find(
                  (x) => x.textContent.trim() === alias,
                );
              choice?.click();
              document.querySelectorAll('[data-pipe-stage]')[ci - 1]?.click();
            });
          }
        }),
      );
    } catch (error) {
      status.textContent = error.message;
      status.className = 'program-status error';
      detail.textContent = 'תקני את הקוד ונסי שוב.';
      $('program-trace').replaceChildren();
      $('program-schedule').replaceChildren();
    }
  }
  function formatPc(value) {
    return `0x${(value >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
  }
  const initial = `add $t0, $t1, $t2\nsub $t3, $t0, $t1\nlw $t4, 4($s0)\nadd $t5, $t4, $t2\nbeq $zero, $zero, done\naddi $t6, $zero, 1\ndone: sw $t5, 8($s0)`;
  $('pipeline-code').value = initial;
  $('track-program').onclick = track;
  $('sample-program').onclick = () => {
    $('pipeline-code').value = initial;
    track();
  };
  $('random-program').onclick = () => {
    const samples = [
      `lw $t0, 4($s0)\nadd $t1, $t0, $t2\nsw $t1, 8($s0)`,
      `add $s0, $t0, $t1\nsub $s1, $s0, $t2\nbeq $zero, $zero, done\naddi $t3, $zero, 2\ndone: or $t4, $t1, $t2`,
      `addi $t0, $zero, 7\nadd $t1, $t0, $t2\nlw $t2, 8($s0)\nbeq $t1, $zero, end\nend: sw $t1, 4($s0)`,
    ];
    $('pipeline-code').value = samples[Math.floor(Math.random() * samples.length)];
    track();
  };
  // Populate additional PC route fields when present.
  function pcValues() {
    const active =
        document.querySelector('#pipeline-instruction-picker .active')?.textContent.trim() || 'add',
      br = active === 'beq',
      jp = active === 'j';
    put('flow-pc4', 'PC+4=0x00400004');
    put('flow-brtarget', br ? 'PC+4+(3<<2)=0x00400010' : 'PC+4+(offset<<2)=לא נבחר');
    put('flow-compare', br ? 'R8=7 − R9=7 = 0' : 'שני ערכי Read Data 1/2');
    put('flow-branch', 'Branch=' + (br ? 1 : 0) + ' · ' + (br ? 'ענף מותנה' : 'לא beq'));
    put('flow-zero', 'Zero=' + (br ? 1 : 0) + ' · תוצאת השוואה');
    put('flow-pcsrc', 'PCSrc=Branch∧Zero=' + (br ? 1 : 0));
    put('flow-pc-choice', br ? '1 · BranchTarget' : jp ? '2 · JumpTarget' : '0 · PC+4');
    put('flow-jump', 'Jump=' + (jp ? 1 : 0) + ' · ' + (jp ? 'קפיצה ישירה' : 'אין קפיצה'));
    put('flow-jtarget', jp ? 'יעד J מתוך Instr[25:0]<<2' : 'Jump path: לא נבחר');
    put('flow-nextpc', br ? 'Next PC=0x00400010' : jp ? 'Next PC=0x00000400' : 'Next PC=0x00400004');
    put('flow-cause', 'Cause=— · EPC=—');
    put('flow-exception', 'Exception=0 · EX.Flush=0');
  }
  if (window.renderPipeline) {
    const old = window.renderPipeline;
    window.renderPipeline = function () {
      old();
      const d = document.querySelector('#pipeline-instruction-picker .active');
      if (d) draw({ name: d.textContent.trim() });
      pcValues();
    };
  }
  $('pipeline-code') && track();
