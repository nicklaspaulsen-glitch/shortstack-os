"""Fix Voice Studio presets tab: search input, filter count, edit-mode buttons."""
import sys

with open("src/app/dashboard/voice-studio/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

original = content  # for diff check at end

# ─── Fix 1: Search row — add border/bg, wrap with count badge ─────────────────
# The placeholder text contains � so we match around it
SEARCH_OLD = (
    '        {/* Search row */}\n'
    '        <div className="relative">\n'
    '          <Search size={13} className="pointer-events-none absolute left-2.5'
    ' top-1/2 -translate-y-1/2 text-[#71717A]" />\n'
    '          <input\n'
    '            type="search"\n'
    '            value={searchQuery}\n'
    '            onChange={(e) => setSearchQuery(e.target.value)}\n'
    '            placeholder="Search presets�"\n'
    '            className="rounded-lg w-full py-1.5 pl-8 pr-3 text-xs'
    ' text-text-primary placeholder-[#71717A] focus:outline-none'
    ' focus:ring-1 focus:ring-[#1D4ED8]/50"\n'
    '\n'
    '          />\n'
    '        </div>'
)

SEARCH_NEW = (
    '        {/* Search row — count badge here so it does not compete with lang select */}\n'
    '        <div className="flex items-center gap-2">\n'
    '          <div className="relative flex-1">\n'
    '            <Search size={13} className="pointer-events-none absolute left-2.5'
    ' top-1/2 -translate-y-1/2 text-[#71717A]" />\n'
    '            <input\n'
    '              type="search"\n'
    '              value={searchQuery}\n'
    '              onChange={(e) => setSearchQuery(e.target.value)}\n'
    '              placeholder="Search presets..."\n'
    '              className="rounded-lg w-full border border-[rgba(0,0,0,0.10)]'
    ' bg-white py-1.5 pl-8 pr-3 text-xs text-text-primary'
    ' placeholder-[#A1A1AA] focus:outline-none focus:border-[#2563EB]/40'
    ' focus:ring-1 focus:ring-[#1D4ED8]/30"\n'
    '            />\n'
    '          </div>\n'
    '          <span className="flex-shrink-0 rounded-full border'
    ' border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] px-2.5 py-1'
    ' text-[10px] font-medium text-[#71717A] tabular-nums">\n'
    '            {filtered.length}/{presets.length}\n'
    '          </span>\n'
    '        </div>'
)

if SEARCH_OLD in content:
    content = content.replace(SEARCH_OLD, SEARCH_NEW, 1)
    print("[FIX 1] Search row OK")
else:
    print("[FIX 1] WARN: search row not found")

# ─── Fix 2: Remove the old trailing count span ────────────────────────────────
COUNT_OLD = (
    '          <span className="ml-auto text-xs text-[#71717A]">'
    '{filtered.length} of {presets.length} presets</span>\n'
)
if COUNT_OLD in content:
    content = content.replace(COUNT_OLD, "", 1)
    print("[FIX 2] Old count span removed OK")
else:
    print("[FIX 2] WARN: old count span not found")

# ─── Fix 3: Language select — remove ml-auto, shorten label ──────────────────
LANG_OLD = (
    '              className="ml-auto rounded-lg border border-[rgba(0,0,0,0.08)]'
    ' bg-[rgba(0,0,0,0.03)] px-2 py-1 text-xs text-[#52525B]'
    ' focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]/50 cursor-pointer"'
)
LANG_NEW = (
    '              className="flex-shrink-0 rounded-lg border border-[rgba(0,0,0,0.08)]'
    ' bg-[rgba(0,0,0,0.03)] px-2 py-1 text-xs text-[#52525B]'
    ' focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]/50 cursor-pointer"'
)
if LANG_OLD in content:
    content = content.replace(LANG_OLD, LANG_NEW, 1)
    print("[FIX 3] Lang select OK")
else:
    print("[FIX 3] WARN: lang select not found")

ALLLANG_OLD = '{l === "all" ? "All languages" : l.toUpperCase()}'
ALLLANG_NEW = '{l === "all" ? "All langs" : l.toUpperCase()}'
if ALLLANG_OLD in content:
    content = content.replace(ALLLANG_OLD, ALLLANG_NEW, 1)
    print("[FIX 3b] All languages -> All langs OK")
else:
    print("[FIX 3b] WARN: all languages label not found")

# ─── Fix 3c: Category pills div — add flex-1 ─────────────────────────────────
CAT_OLD = '          <div className="flex flex-wrap gap-1.5">'
CAT_NEW = '          <div className="flex flex-1 flex-wrap gap-1.5">'
if CAT_OLD in content:
    content = content.replace(CAT_OLD, CAT_NEW, 1)
    print("[FIX 3c] Category pills flex-1 OK")
else:
    print("[FIX 3c] WARN: cat pills div not found")

# ─── Fix 4: Waveform placeholder opacity ─────────────────────────────────────
WAVE_OLD = (
    '            <div className="flex items-end justify-center gap-[2px] h-6'
    ' opacity-30 group-hover/play:opacity-70 transition-opacity duration-200"'
    ' aria-hidden="true">'
)
WAVE_NEW = (
    '            <div className="flex items-end justify-center gap-[2px] h-6'
    ' opacity-40 group-hover/play:opacity-80 transition-opacity duration-200"'
    ' aria-hidden="true">'
)
if WAVE_OLD in content:
    content = content.replace(WAVE_OLD, WAVE_NEW, 1)
    print("[FIX 4] Waveform opacity OK")
else:
    print("[FIX 4] WARN: waveform div not found")

# ─── Fix 5: Edit mode buttons — style as real buttons ────────────────────────
EDIT_OLD = (
    '              <div className="flex items-center gap-2">\n'
    '                <button\n'
    '                  type="button"\n'
    '                  onClick={() => { setEditMode(false); onTest(); }}\n'
    '                  className="text-[10px] text-[#52525B] hover:text-[#1D4ED8] cursor-pointer"\n'
    '                >\n'
    '                  Preview\n'
    '                </button>\n'
    '                <button\n'
    '                  type="button"\n'
    '                  onClick={() => setEditMode(false)}\n'
    '                  className="text-[10px] text-[#71717A] hover:text-[#52525B] cursor-pointer"\n'
    '                >\n'
    '                  Done\n'
    '                </button>\n'
    '              </div>'
)
EDIT_NEW = (
    '              <div className="flex items-center gap-1.5">\n'
    '                <button\n'
    '                  type="button"\n'
    '                  onClick={() => { setEditMode(false); onTest(); }}\n'
    '                  className="flex items-center gap-1 rounded-lg bg-[#2563EB]'
    ' px-2.5 py-1 text-[10px] font-medium text-white hover:bg-[#1D4ED8]'
    ' transition-colors cursor-pointer"\n'
    '                >\n'
    '                  <Play size={9} />\n'
    '                  Hear it\n'
    '                </button>\n'
    '                <button\n'
    '                  type="button"\n'
    '                  onClick={() => setEditMode(false)}\n'
    '                  className="rounded-lg border border-[rgba(0,0,0,0.08)]'
    ' bg-[rgba(0,0,0,0.03)] px-2.5 py-1 text-[10px] text-[#52525B]'
    ' hover:text-text-primary cursor-pointer"\n'
    '                >\n'
    '                  Cancel\n'
    '                </button>\n'
    '              </div>'
)
if EDIT_OLD in content:
    content = content.replace(EDIT_OLD, EDIT_NEW, 1)
    print("[FIX 5] Edit mode buttons OK")
else:
    print("[FIX 5] WARN: edit mode buttons not found")

# ─── Write ────────────────────────────────────────────────────────────────────
if content == original:
    print("NO CHANGES MADE — all patterns missed")
    sys.exit(1)

with open("src/app/dashboard/voice-studio/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print(f"Done — {content.count(chr(10)) - original.count(chr(10)):+d} lines delta")
