import re

p = "cloudflare-free/compositions/index--2---2-/index.html"
s = open(p, encoding="utf-8").read()

# 1. pindahkan #tpls ke dalam #root agar root komposisi jadi elemen pertama di body
m = re.search(r'<div id="tpls".*?\n</div>\n', s, re.S)
if m:
    tpls = m.group(0)
    s = s.replace(tpls, "", 1)
    s = re.sub(r'(<div id="root"[^>]*>\n)', lambda x: x.group(1) + tpls, s, count=1)

# 2. beri id ke setiap clip yang belum punya
k = [0]

def add(m):
    k[0] += 1
    return '<div id="clip-%02d" %s' % (k[0], m.group(1))

s = re.sub(r'<div (class="clip[^"]*" data-start=)', add, s)

open(p, "w", encoding="utf-8").write(s)
print("tpls dipindah:", bool(m), "| clip diberi id:", k[0])
