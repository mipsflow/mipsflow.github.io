export const pipeStageNames = [
  'IF · הבאת פקודה',
  'ID · פענוח וקריאה',
  'EX · ביצוע',
  'MEM · זיכרון',
  'WB · כתיבה חזרה',
];
export const pipeTrace = {
  add: [
    [
      'הפקודה נשלפת לפי ה־PC.',
      'PC=0x00400000 → Instruction Memory → IF/ID. הפקודה נשמרת ברגיסטר IF/ID.',
      'PC=0x00400000 · Instr=0x012A4020',
      'PC+4=0x00400004 · IF/ID.Write=1',
    ],
    [
      'מפענחים את opcode וקוראים את האוגרים.',
      'rs=9 ו־rt=10 בוחרים את R9 ואת R10. הערכים 7 ו־5 נרשמים ב־ID/EX.',
      'R9=7 · R10=5 · rd=8',
      'RegWrite=1 · ALUOp=10 · RegDst=1',
    ],
    [
      'ה־ALU מקבל את שני האוגרים ומחבר.',
      'שני הבוררים בוחרים את הנתונים מהאוגרים. ה־ALU מחשב 7+5=12.',
      'ForwardA=00 · ForwardB=00 · 7+5=12',
      'ALUSrc=0 · ALUControl=0010',
    ],
    [
      'התוצאה עוברת דרך EX/MEM; הזיכרון לא נדרש.',
      '12 ממשיך ברגיסטר EX/MEM. MemRead ו־MemWrite שווים 0, לכן לא קוראים ולא כותבים בזיכרון.',
      'ALUResult=12 · Data Memory לא פעיל',
      'MemRead=0 · MemWrite=0',
    ],
    [
      'התוצאה נבחרת ונכתבת לאוגר.',
      'MEM/WB מעביר 12 דרך בורר MemtoReg אל R8 ($t0).',
      'MEM/WB=12 → R8 ($t0)',
      'MemtoReg=0 · RegWrite=1',
    ],
  ],
  addi: [
    [
      'הפקודה addi נשלפת ונרשמת ב־IF/ID.',
      'ה־PC מצביע על הפקודה. IF/ID שומר את הפקודה ואת PC+4.',
      'PC=0x00400000 · Instr=0x21280008',
      'PC+4=0x00400004',
    ],
    [
      'קוראים rs ומכינים את immediate.',
      'R9 מספק 7. המספר 8 עובר Sign Extend ונשמר ב־ID/EX יחד עם האותות.',
      'R9=7 · imm=8 · rt=8',
      'RegWrite=1 · ALUSrc=1 · RegDst=0',
    ],
    [
      'ה־ALU מחבר אוגר ומספר קבוע.',
      'Forwarding MUX בוחר את R9=7; ALUSrc בוחר את 8 המורחב. התוצאה היא 15.',
      '7+8=15 · ForwardA=00',
      'ALUSrc=1 · ALUControl=0010',
    ],
    [
      'התוצאה עוברת הלאה; הזיכרון לא פועל.',
      'EX/MEM מחזיק את 15. אין פעולת קריאה או כתיבה ב־Data Memory.',
      'ALUResult=15 · Memory לא פעיל',
      'MemRead=0 · MemWrite=0',
    ],
    [
      '15 נכתב אל R8.',
      'MEM/WB מעביר את תוצאת ה־ALU אל אוגר היעד rt.',
      '15 → R8 ($t0)',
      'MemtoReg=0 · RegWrite=1',
    ],
  ],
  lw: [
    [
      'פקודת lw נשלפת אל IF/ID.',
      'ה־PC מביא את הפקודה, ורגיסטר IF/ID שומר אותה עד שלב הפענוח.',
      'PC=0x00400000 · Instr=0x8D280004',
      'IF/ID.Write=1',
    ],
    [
      'קוראים בסיס ומרחיבים offset.',
      'R9=100 הוא בסיס הכתובת; offset=4 מורחב ל־32 ביט. הנתונים והאותות נכנסים ל־ID/EX.',
      'R9=100 · imm=4 · rt=8',
      'MemRead=1 · RegWrite=1 · ALUSrc=1',
    ],
    [
      'מחשבים כתובת עם ה־ALU.',
      '100+4=104. התוצאה ויעד האוגר עוברים לרגיסטר EX/MEM.',
      '100+4=104 · Address=104',
      'ALUControl=0010',
    ],
    [
      'זיכרון הנתונים קורא בכתובת 104.',
      'MemRead=1 גורם לזיכרון הנתונים להחזיר M[104]=42. הנתון נרשם ב־MEM/WB.',
      'Address=104 · ReadData=42',
      'MemRead=1 · MemWrite=0',
    ],
    [
      'הערך שנקרא נכתב אל R8.',
      'בורר MemtoReg בוחר את ReadData=42 במקום תוצאת ה־ALU, ו־RegWrite שומר אותו ב־R8.',
      '42 → R8 ($t0)',
      'MemtoReg=1 · RegWrite=1',
    ],
  ],
  sw: [
    [
      'פקודת sw נשלפת ל־IF/ID.',
      'הפקודה ו־PC+4 נשמרים כדי שהתחנה הבאה תפענח אותם.',
      'PC=0x00400000 · Instr=0xAD280004',
      'IF/ID.Write=1',
    ],
    [
      'קוראים את ערך האחסון ואת בסיס הכתובת.',
      'R9=100 הוא הבסיס; R8=42 הוא הנתון שייכתב. offset=4 נכנס ל־ID/EX.',
      'R9=100 · R8=42 · imm=4',
      'MemWrite=1 · RegWrite=0',
    ],
    [
      'ה־ALU מחשב את כתובת הגישה לזיכרון.',
      '100+4=104. כתובת היעד והנתון 42 עוברים יחד לרגיסטר EX/MEM.',
      'Address=104 · WriteData=42',
      'ALUSrc=1 · ALUControl=0010',
    ],
    [
      'הנתון נכתב לזיכרון.',
      'EX/MEM נותן Address=104 ו־WriteData=42. MemWrite=1 שומר M[104]←42.',
      'M[104] ← 42',
      'MemWrite=1 · MemRead=0',
    ],
    [
      'אין שלב כתיבה לאוגר.',
      'sw מעדכנת את הזיכרון בלבד; רגיסטר WB לא כותב אוגר.',
      'RegWrite=0 · אין כתיבה לאוגר',
      'MemtoReg=X · RegWrite=0',
    ],
  ],
  beq: [
    [
      'פקודת beq מגיעה ל־IF/ID.',
      'נשלפים הפקודה ו־PC+4. בהמשך נבדוק אם שני האוגרים שווים.',
      'PC=0x00400000 · Instr=0x11090003',
      'IF/ID.Write=1',
    ],
    [
      'קוראים שני אוגרים ומחשבים יעד.',
      'R8=7 ו־R9=7 נכנסים ל־ID/EX. ההיסט 3 מורחב ומוזז שמאלה 2 כדי להכין כתובת branch.',
      'R8=7 · R9=7 · offset=3',
      'Branch=1 · ALUSrc=0 · ALUOp=01',
    ],
    [
      'ה־ALU מחסר כדי לבדוק שוויון.',
      '7−7=0, לכן Zero=1. יחד עם Branch=1 זה אומר שהקפיצה המותנית מתקיימת.',
      '7−7=0 · Zero=1',
      'ALUControl=0110 · Branch=1',
    ],
    [
      'אין גישת נתונים לזיכרון.',
      'beq לא קוראת ולא כותבת ב־Data Memory. כתובת היעד נבחרת במסלול ה־PC.',
      'Memory לא פעיל · BranchTarget=0x00400010',
      'MemRead=0 · MemWrite=0',
    ],
    [
      'אין כתיבה לאוגר.',
      'הפקודה רק משווה ובוחרת את ה־PC הבא. אין תוצאה שצריך לכתוב ל־Register File.',
      'RegWrite=0 · PC=0x00400010',
      'Branch=1 · RegWrite=0',
    ],
  ],
  j: [
    [
      'פקודת j נשלפת ל־IF/ID.',
      'כמו כל פקודה, היא מגיעה מזיכרון ההוראות דרך ה־PC.',
      'PC=0x00400000 · Instr=0x08000100',
      'IF/ID.Write=1',
    ],
    [
      'מזהים קפיצה ומרכיבים כתובת יעד.',
      'יחידת הבקרה מזהה Jump=1. שדה היעד מוזז ומתחבר לביטים העליונים של PC+4. פקודות צעירות יותר בצינור מבוטלות לפי אותות Flush.',
      'JumpTarget=0x00000400',
      'Jump=1 · IF.Flush=1',
    ],
    [
      'ה־ALU לא נדרש.',
      'הכתובת לא מחושבת ב־ALU. אות Jump מנתב את יעד הקפיצה למסלול ה־PC.',
      'ALU לא בשימוש',
      'ALUOp=X',
    ],
    [
      'אין קריאה או כתיבה לזיכרון הנתונים.',
      'הקפיצה אינה משתמשת ב־Data Memory.',
      'Memory לא פעיל',
      'MemRead=0 · MemWrite=0',
    ],
    [
      'אין כתיבה לאוגר.',
      'פקודת j משנה את מסלול הפקודות בלבד, ולכן שלב WB לא כותב ל־Register File.',
      'RegWrite=0',
      'RegWrite=0',
    ],
  ],
};
export const pipeSequences = [
  {
    id: 'forward',
    title: '1 · תלות ALU ו־Forwarding',
    desc: 'הפקודה השנייה צריכה את R16 שהראשונה מחשבת. כשה־sub מגיעה ל־EX, התוצאה כבר ב־EX/MEM, ולכן ForwardA=10 מעביר 12 ישר לקלט A. אין בועה.',
    instructions: ['add $s0,$t0,$t1', 'sub $s1,$s0,$t2', 'and $s2,$s1,$t3'],
    schedule: [
      ['IF', 'ID', 'EX', 'MEM', 'WB', '', ''],
      ['', 'IF', 'ID', 'EX', 'MEM', 'WB', ''],
      ['', '', 'IF', 'ID', 'EX', 'MEM', 'WB'],
    ],
  },
  {
    id: 'load',
    title: '2 · סיכון lw-use ובועה',
    desc: 'add צריכה את R8 שה־lw קוראת. הנתון מגיע רק בסוף MEM ולכן אינו מוכן למחזור ה־EX הבא. יחידת Hazard מקפיאה את ה־PC ואת IF/ID למחזור אחד: הפקודה נשארת ב־ID פעם נוספת, ובאותו מחזור ID/EX מקבל NOP. אחר כך Forwarding מעביר את הערך.',
    instructions: ['lw $t0,4($s0)', 'add $t1,$t0,$s1', 'sw $t1,4($s0)'],
    schedule: [
      ['IF', 'ID', 'EX', 'MEM', 'WB', '', '', ''],
      ['', 'IF', 'ID', 'ID (המתנה)', 'EX', 'MEM', 'WB', ''],
      ['', '', 'IF', 'IF (קפוא)', 'ID', 'EX', 'MEM', 'WB'],
    ],
    bubbles: [{ cycle: 4, label: 'ID/EX.Flush=1 · NOP' }],
  },
  {
    id: 'branch',
    title: '3 · Branch שנלקח ו־Flush',
    desc: 'במודל הזה beq מוכרעת בשלב ID. הפקודה שב־IF באותו מחזור מבוטלת, ובמחזור הבא נשלפת הפקודה מכתובת היעד. פקודת היעד אינה נשטפת.',
    instructions: [
      'add $s0,$t0,$t1',
      'beq $zero,$zero,target',
      'addi $t2,$zero,1 · דרך שגויה',
      'or $t3,$s2,$s3 · יעד',
    ],
    schedule: [
      ['IF', 'ID', 'EX', 'MEM', 'WB', '', '', ''],
      ['', 'IF', 'ID', 'EX', 'MEM', 'WB', '', ''],
      ['', '', 'FLUSH', '', '', '', '', ''],
      ['', '', '', 'IF', 'ID', 'EX', 'MEM', 'WB'],
    ],
    flushes: [{ row: 2, col: 2 }],
  },
];
export const steps = ['fetch', 'decode', 'read', 'extend', 'alu', 'mem', 'writeback', 'branch'];
