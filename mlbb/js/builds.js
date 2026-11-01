/*
 * Build templates (items, emblem, battle spell). Community-standard archetypes.
 * Item names follow the in-game English names so they are easy to find in the shop.
 * Lane adjustments: jungle -> boots get a Retribution blessing, roam -> boots get a Roam blessing.
 */
const BUILDS = {
  mm_crit: { label: "מרקסמן קריט",
    items: ["Swift Boots", "Windtalker", "Berserker's Fury", "Haas's Claws", "Malefic Roar", "Wind of Nature"],
    emblem: "Marksman — Weapons Master + Quantum Charge", spell: "Flicker / Inspire",
    note: "Wind of Nature נגד מתנקשים פיזיים; Malefic Roar נגד טנקים עם שריון." },
  mm_atkspd: { label: "מרקסמן מהירות התקפה / On-Hit",
    items: ["Swift Boots", "Demon Hunter Sword", "Golden Staff", "Corrosion Scythe", "Malefic Roar", "Wind of Nature"],
    emblem: "Marksman — Agility + Weapons Master + Quantum Charge", spell: "Flicker / Inspire",
    note: "מצוין נגד טנקים וקבוצות עם הרבה HP." },
  mm_phys_burst: { label: "מרקסמן בורסט פיזי",
    items: ["Swift Boots", "Blade of the Heptaseas", "Hunter Strike", "Endless Battle", "Blade of Despair", "Malefic Roar"],
    emblem: "Marksman / Assassin — Rupture + Weapons Master + Lethal Ignition", spell: "Flicker",
    note: "Rose Gold Meteor או Wind of Nature כפריט שישי נגד מתנקשים." },
  mm_magic: { label: "מרקסמן מג'יק",
    items: ["Arcane Boots", "Feather of Heaven", "Enchanted Talisman", "Genius Wand", "Holy Crystal", "Blood Wings"],
    emblem: "Mage — Mystery Shop/Bargain Hunter + Weapons Master + Lethal Ignition", spell: "Flicker",
    note: "Winter Crown להישרדות נגד דייב." },
  mage_burst: { label: "מאג' בורסט",
    items: ["Arcane Boots", "Enchanted Talisman", "Lightning Truncheon", "Holy Crystal", "Divine Glaive", "Blood Wings"],
    emblem: "Mage — Agility/Rupture + Weapons Master + Lethal Ignition", spell: "Flicker",
    note: "Winter Crown נגד מתנקשים; Glowing Wand נגד הילרים." },
  mage_poke: { label: "מאג' פוק / מיד",
    items: ["Arcane Boots", "Clock of Destiny", "Lightning Truncheon", "Holy Crystal", "Genius Wand", "Blood Wings"],
    emblem: "Mage — Inspire/Mystery Shop + Bargain Hunter + Lethal Ignition", spell: "Flicker / Aegis",
    note: "Ice Queen Wand/Glowing Wand לפי ההרכב היריב." },
  mage_dps: { label: "מאג' DPS מתמשך",
    items: ["Arcane Boots", "Enchanted Talisman", "Clock of Destiny", "Genius Wand", "Glowing Wand", "Holy Crystal"],
    emblem: "Mage — Agility + Bargain Hunter + Impure Rage", spell: "Flicker / Aegis",
    note: "Glowing Wand חובה נגד הילרים וטנקים עם רגנרציה." },
  mage_sustain: { label: "מאג' עמיד",
    items: ["Arcane Boots", "Enchanted Talisman", "Clock of Destiny", "Winter Crown", "Athena's Shield", "Brute Force Breastplate"],
    emblem: "Mage / Tank — Vitality + Tenacity + Concussive Blast", spell: "Flicker / Vengeance",
    note: "פריטי הגנה לפי סוג הנזק של היריב." },
  assassin_phys: { label: "מתנקש פיזי",
    items: ["Tough Boots", "Blade of the Heptaseas", "Hunter Strike", "Malefic Roar", "Blade of Despair", "Immortality"],
    emblem: "Assassin — Rupture + Seasoned Hunter/Master Assassin + Killing Spree", spell: "Retribution",
    note: "Rose Gold Meteor/Winter Crown נגד בורסט מג'יק." },
  fighter_jungle: { label: "פייטר ג'ונגל",
    items: ["Tough Boots", "War Axe", "Hunter Strike", "Blade of Despair", "Malefic Roar", "Immortality"],
    emblem: "Fighter / Assassin — Rupture + Seasoned Hunter + Killing Spree", spell: "Retribution",
    note: "Sea Halberd נגד הילרים ולייפסטיל." },
  fighter_exp: { label: "פייטר EXP (DPS)",
    items: ["Tough Boots", "War Axe", "Hunter Strike", "Queen's Wings", "Dominance Ice", "Immortality"],
    emblem: "Fighter — Firmness + Festival of Blood + Brave Smite", spell: "Vengeance / Petrify",
    note: "Sea Halberd נגד הילרים; Oracle נגד מאג'ים." },
  fighter_burst: { label: "פייטר בורסט",
    items: ["Tough Boots", "Blade of the Heptaseas", "Hunter Strike", "Malefic Roar", "Queen's Wings", "Immortality"],
    emblem: "Fighter — Rupture + Festival of Blood + Brave Smite", spell: "Petrify / Vengeance",
    note: "Blade of Despair אם המשחק נמשך ואתה במובילות." },
  fighter_sustain: { label: "פייטר עמיד / סאסטיין",
    items: ["Tough Boots", "War Axe", "Bloodlust Axe", "Oracle", "Queen's Wings", "Athena's Shield"],
    emblem: "Fighter — Firmness + Festival of Blood + Brave Smite", spell: "Vengeance / Flicker",
    note: "Dominance Ice נגד מרקסמנים והילים." },
  fighter_magic: { label: "פייטר מג'יק",
    items: ["Warrior Boots", "Concentrated Energy", "Feather of Heaven", "Oracle", "Athena's Shield", "Glowing Wand"],
    emblem: "Fighter / Mage — Agility + Festival of Blood + Brave Smite", spell: "Vengeance / Petrify",
    note: "בג'ונגל: Starlium Scythe במקום Feather of Heaven." },
  xborg: { label: "X.Borg",
    items: ["Warrior Boots", "War Axe", "Blade of the Heptaseas", "Hunter Strike", "Queen's Wings", "Immortality"],
    emblem: "Fighter — Rupture + Festival of Blood + Brave Smite", spell: "Petrify / Vengeance",
    note: "Sea Halberd נגד יריבים עם הרבה ריפוי." },
  masha: { label: "Masha (אחרי הריוורק — Berserker)",
    items: ["Tough Boots", "War Axe", "Queen's Wings", "Brute Force Breastplate", "Oracle", "Immortality"],
    emblem: "Fighter — Firmness + Festival of Blood + Brave Smite", spell: "Vengeance",
    note: "לפי מדריכי פאץ' 2.2.16: לחימה מתמשכת בחזית במקום פיצול. Warrior Boots נגד הרכב פיזי." },
  argus: { label: "Argus — מהירות התקפה",
    items: ["Swift Boots", "Corrosion Scythe", "Demon Hunter Sword", "Golden Staff", "Malefic Roar", "Immortality"],
    emblem: "Fighter / Assassin — Agility + Weapons Master + Brave Smite", spell: "Petrify / Vengeance",
    note: "קיבל באף ב-Season 42. Wind of Nature לשרוד בורסט פיזי." },
  hirara: { label: "Hirara — מתנקשת ג'ונגל",
    items: ["Tough Boots", "Hunter Strike", "War Axe", "Blade of the Heptaseas", "Malefic Roar", "Immortality"],
    emblem: "Assassin — Thrill + Seasoned Hunter + Impure Rage", spell: "Retribution",
    note: "הנזק שלה למיניונים מופחת, ולכן היא מתאימה לג'ונגל. Antique Cuirass אצל היריב מחליש אותה." },
  tank_roam: { label: "טנק / תומך רואם",
    items: ["Tough Boots", "Dominance Ice", "Antique Cuirass", "Athena's Shield", "Oracle", "Immortality"],
    emblem: "Tank / Support — Vitality + Tenacity + Concussive Blast / Focusing Mark", spell: "Flicker / Vengeance",
    note: "Radiant Armor נגד דמויות מג'יק עם נזק מתמשך." },
  tank_exp: { label: "טנק EXP / ג'ונגל",
    items: ["Tough Boots", "Cursed Helmet", "Antique Cuirass", "Dominance Ice", "Radiant Armor", "Oracle"],
    emblem: "Tank — Vitality + Tenacity + Concussive Blast", spell: "Vengeance / Petrify",
    note: "בג'ונגל: מגפיים עם Retribution; Thunder Belt למרדפים." },
  support_heal: { label: "תומך ריפוי",
    items: ["Tough Boots", "Flask of the Oasis", "Fleeting Time", "Dominance Ice", "Oracle", "Athena's Shield"],
    emblem: "Support — Agility + Pull Yourself Together + Focusing Mark", spell: "Flicker / Aegis",
    note: "Enchanted Talisman כשצריך יותר כישורים בתדירות גבוהה." },
};

const BOOT_BLESSING = {
  jungle: " + Retribution blessing (Ice / Flame / Bloody)",
  roam: " + Roam blessing (Conceal / Encourage / Favor / Dire Hit)",
};

function buildFor(hero, lane) {
  const key = hero.builds[lane] || Object.values(hero.builds)[0];
  const tpl = BUILDS[key];
  if (!tpl) return null;
  const items = tpl.items.slice();
  if (BOOT_BLESSING[lane]) items[0] = items[0] + BOOT_BLESSING[lane];
  let spell = tpl.spell;
  if (lane === "jungle") spell = "Retribution";
  return { ...tpl, items, spell, key };
}
