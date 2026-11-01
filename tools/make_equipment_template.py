"""Build the equipment workbook template from src/data/gear.json (slots, coins).

    python tools/make_equipment_template.py src/data/gear.json Farwilds_Equipment_Template.xlsx
"""
import json, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

gear = json.load(open(sys.argv[1]))
out = sys.argv[2]
CATS = [("weapon","Weapons","Melee weapons"),("firearm","Firearms","Powder-, rune- or Quick-fired guns"),
        ("ammunition","Ammunition","Arrows, bolts, shot"),("armour","Armour","Worn pieces that give Armour"),
        ("shield","Shields","Off-hand gear with its own armour points"),("clothing","Clothing","Worn pieces without armour"),
        ("jewellery","Jewellery","Rings, amulets, circlets"),("tool","Tools","Kits and instruments, tied to proficiencies"),
        ("gear","Adventuring gear","Rope, torches, packs"),("consumable","Consumables","Food, drink, draughts")]
SLOTS = [s["id"] for s in gear["slots"]]
COINS = [c["short"] for c in gear["coins"]]
DMG = ["bludgeoning","piercing","slashing","acid","cold","fire","lightning","sonic","force","necrotic","psychic","radiant","poison"]
COLS = [  # header, width, required, note
 ("id",14,True,"Unique, lowercase, no spaces: longsword, leather-boots. Never change it once used — saved characters point to it."),
 ("name",22,True,"Display name."),
 ("category",14,True,"From the list (Lists sheet)."),
 ("slot",11,False,"Gear slot it is worn in (weapons: mainhand, offhand or ranged). Blank = carried only. Grip goes in properties."),
 ("price",8,True,"Default price, whole number."),
 ("coin",6,True,"gp, sp or cp."),
 ("stackable",9,False,"yes = many in one bag cell (arrows, rations)."),
 ("weight_kg",9,False,"Optional; no encumbrance rule yet."),
 ("armour",8,False,"Armour points (armour and shields)."),
 ("attack_power",11,False,"Attack Power the item adds (weapons)."),
 ("damage",8,False,"Dice, e.g. 1d8."),
 ("damage_type",13,False,"From the list."),
 ("reach_m",8,False,"Reach in metres (grid square = 2 m)."),
 ("armor_type",13,False,"Light Armor, Medium Armor, Heavy Armor or Garment."),
 ("str_need",8,False,"Strength score needed to wear it without penalty."),
 ("stealth_disadvantage",10,False,"yes = disadvantage on Stealth while worn."),
 ("properties",22,False,"Comma-separated tags: Two-handed, Versatile (either hand), Light, Thrown (Range…), Heavy, Loading…"),
 ("bonuses",24,False,"Flat bonuses, comma-separated: STR +1, Stealth -2, Leech +1"),
 ("description",40,False,"Short text shown on hover."),
 ("notes",24,False,"Your notes; not shown in the app."),
]
SAMPLES_RAW = [
 ["longsword","Longsword","weapon","mainhand",15,"gp","",1.5,"","", "1d8","slashing",2,"versatile","","A straight double-edged blade.",""],
 ["dagger","Dagger","weapon","mainhand",2,"gp","",0.5,"","","1d4","piercing",2,"light, thrown","","",""],
 ["shortbow","Shortbow","weapon","ranged",25,"gp","",1,"","","1d6","piercing","","two-handed","","",""],
 ["arrow","Arrow","ammunition","",5,"cp","yes",0.05,"","","","","","","","",""],
 ["wooden-shield","Wooden shield","shield","offhand",10,"gp","",3,"","","","","","","","",""],
 ["iron-helm","Iron helm","armour","head",8,"gp","",2,"","","","","","","","",""],
 ["chain-shirt","Chain shirt","armour","chest",50,"gp","",9,"","","","","","","","",""],
 ["leather-boots","Leather boots","armour","feet",2,"gp","",1,"","","","","","","","",""],
 ["travelling-cloak","Travelling cloak","clothing","back",5,"sp","",1,"","","","","","","","",""],
 ["signet-ring","Signet ring","jewellery","ring1",5,"gp","",0,"","","","","","","","",""],
 ["thieves-tools","Thieves' tools","tool","",25,"gp","",0.5,"","","","","","","","For lockpicking.",""],
 ["rope","Rope (15 m)","gear","",1,"gp","",5,"","","","","","","","",""],
 ["torch","Torch","gear","",1,"cp","yes",0.5,"","","","","","","","",""],
 ["rations","Rations (1 day)","consumable","",5,"sp","yes",1,"","","","","","","","",""],
 ["healing-draught","Healing draught","consumable","",50,"gp","yes",0.2,"","","","","","","","Divine healing in a bottle.",""],
]

SAMPLES = [r[:13] + ["", "", ""] + r[13:] for r in SAMPLES_RAW]
ARMOR_TYPES = ["Light Armor", "Medium Armor", "Heavy Armor", "Garment"]

wb = Workbook()
ws = wb.active; ws.title = "Equipment"
head = PatternFill("solid", fgColor="1D2430"); req = PatternFill("solid", fgColor="9A6B1F")
thin = Side(style="thin", color="D5D8D2")
for i,(h,w,r,_) in enumerate(COLS,1):
    c = ws.cell(1,i,h); c.font = Font(bold=True, color="FFFFFF", name="Calibri"); c.fill = req if r else head
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws.column_dimensions[get_column_letter(i)].width = w
for r,row in enumerate(SAMPLES,2):
    for i,v in enumerate(row,1):
        c = ws.cell(r,i,v if v != "" else None); c.border = Border(bottom=thin)
ws.freeze_panes = "C2"
ws.auto_filter.ref = f"A1:{get_column_letter(len(COLS))}{len(SAMPLES)+1}"
# Lists
ls = wb.create_sheet("Lists")
lists = {"category":[c[0] for c in CATS],"slot":SLOTS,"coin":COINS,"damage_type":DMG,"yes/no":["yes","no"],"armor_type":ARMOR_TYPES}
for i,(k,vals) in enumerate(lists.items(),1):
    ls.cell(1,i,k).font = Font(bold=True)
    for j,v in enumerate(vals,2): ls.cell(j,i,v)
    ls.column_dimensions[get_column_letter(i)].width = 16
ls.cell(1,7,"category").font = Font(bold=True); ls.cell(1,8,"label").font = Font(bold=True); ls.cell(1,9,"what goes in it").font = Font(bold=True)
for j,(cid,lab,desc) in enumerate(CATS,2): ls.cell(j,7,cid); ls.cell(j,8,lab); ls.cell(j,9,desc)
ls.column_dimensions["H"].width = 18; ls.column_dimensions["I"].width = 42
def dv(col, listcol, n):
    d = DataValidation(type="list", formula1=f"=Lists!${listcol}$2:${listcol}${n+1}", allow_blank=True)
    d.error = "Pick a value from the list (Lists sheet)."; ws.add_data_validation(d); d.add(f"{col}2:{col}2000")
idx = {h:get_column_letter(i) for i,(h,*_) in enumerate(COLS,1)}
dv(idx["category"],"A",len(lists["category"])); dv(idx["slot"],"B",len(SLOTS)); dv(idx["coin"],"C",len(COINS))
dv(idx["damage_type"],"D",len(DMG)); dv(idx["stackable"],"E",2); dv(idx["stealth_disadvantage"],"E",2)
dv(idx["armor_type"],"F",len(ARMOR_TYPES))
num = DataValidation(type="whole", operator="greaterThanOrEqual", formula1="0", allow_blank=False); num.error="Whole number, 0 or more."
ws.add_data_validation(num); num.add(f"{idx['price']}2:{idx['price']}2000")
# Read me
rm = wb.create_sheet("Read me", 0)
rm.column_dimensions["A"].width = 16; rm.column_dimensions["B"].width = 90
lines = [("FARWILDS EQUIPMENT LIST",""),("",""),
 ("What","One row per item on the Equipment sheet. The app's Add and Purchase drawers list these items."),
 ("Samples","The rows already there are samples so the app has something to show. Replace or delete them."),
 ("Weight","weight_kg feeds encumbrance: carry capacity = Strength score × CarryPerSTR kg (8 by default)."),
 ("Gold headers","Required columns. Dark headers are optional; leave blank when not settled."),
 ("Lists","Category, slot, coin, damage type and yes/no come from the Lists sheet (dropdowns)."),
 ("Prices","Whole numbers in one coin: 15 gp, 5 sp, 1 cp. Rates are set in src/data/gear.json (placeholder 1 gp = 10 sp = 100 cp)."),
 ("Stats","Armour, Attack Power, damage and bonuses are recorded but not yet used by the app; Rulebook 6.1/6.2 are open."),
 ("Into the app","python tools/equipment_xlsx_to_json.py Farwilds_Equipment.xlsx --into src/data/equipment.json"),
 ("",""),("COLUMNS","")] + [(h,n) for h,_,_,n in COLS]
for r,(a,b) in enumerate(lines,1):
    rm.cell(r,1,a).font = Font(bold=True); rm.cell(r,2,b).alignment = Alignment(wrap_text=True, vertical="top")
rm["A1"].font = Font(bold=True, size=14)
wb.save(out)
print("saved", out)
