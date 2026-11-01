/*
 * Curated hero database (editorial / community knowledge).
 * Fields: name | roles | lanes | metaTier | strongAgainst | weakAgainst | synergy | build templates per lane
 * Lanes: gold, exp, mid, jungle, roam.  Build: "lane:template,lane:template" or one template for all lanes.
 * metaTier is a community-consensus estimate, NOT live statistics; live stats come from js/api.js.
 */
const HERO_ROWS = `
Miya|Marksman|gold|C|Layla,Moskov,Irithel|Saber,Natalia,Lancelot,Hayabusa|Angela,Mathilda,Diggie,Estes|gold:mm_atkspd
Balmond|Fighter|jungle,exp|B|Fanny,Ling,Lancelot|Baxia,Esmeralda,Dyrroth,Karrie|Tigreal,Atlas,Mathilda|jungle:fighter_jungle,exp:fighter_exp
Saber|Assassin|jungle,roam|B|Miya,Layla,Eudora,Pharsa|Kaja,Franco,Ruby,Martis|Tigreal,Atlas,Kaja|assassin_phys
Alice|Mage,Tank|exp,roam,jungle|B|Dyrroth,Thamuz,Esmeralda|Baxia,Karrie,Valir,Kaja|Tigreal,Atlas,Franco|exp:mage_sustain,roam:tank_roam,jungle:mage_sustain
Nana|Mage,Support|mid,roam|C|Lancelot,Gusion,Fanny|Valir,Kagura,Ling|Selena,Eudora,Aurora|mage_poke
Tigreal|Tank,Support|roam|B|Ling,Fanny,Lancelot,Wanwan|Diggie,Kaja,Valir,Lylia|Pharsa,Odette,Vale,Yve|tank_roam
Alucard|Fighter,Assassin|jungle,exp|C|Layla,Miya,Eudora|Baxia,Dyrroth,Kaja,Esmeralda|Angela,Estes,Tigreal|jungle:fighter_jungle,exp:fighter_exp
Karina|Assassin,Mage|jungle,mid|B|Layla,Miya,Lancelot,Gusion|Kaja,Ruby,Chou,Franco|Tigreal,Atlas,Kaja|mage_burst
Akai|Tank,Support|roam,jungle,exp|B|Wanwan,Beatrix,Ling|Diggie,Kaja,Valir|Pharsa,Odette,Vale,Yve|tank_roam
Franco|Tank,Support|roam|B|Ling,Lancelot,Fanny,Hayabusa|Diggie,Valir,Lylia,Kaja|Saber,Karina,Gusion,Chou|tank_roam
Bane|Fighter,Mage|exp,jungle,mid|C|Layla,Miya,Nana|Lancelot,Ling,Hayabusa|Atlas,Tigreal,Mathilda|exp:fighter_exp,jungle:fighter_jungle,mid:mage_poke
Bruno|Marksman|gold|A|Layla,Miya,Irithel|Natalia,Saber,Hayabusa|Estes,Angela,Diggie|gold:mm_crit
Clint|Marksman|gold|B|Wanwan,Miya,Layla|Natalia,Saber,Lancelot,Helcurt|Angela,Tigreal,Atlas|gold:mm_phys_burst
Rafaela|Support|roam|S|Kagura,Chang'e,Pharsa|Saber,Natalia,Helcurt,Franco|Miya,Layla,Claude,Bruno|support_heal
Eudora|Mage|mid,roam|A|Lancelot,Gusion,Fanny,Layla|Valir,Kaja,Ling,Diggie|Tigreal,Atlas,Kaja|mage_burst
Zilong|Fighter,Assassin|exp,jungle|C|Layla,Miya,Eudora|Chou,Kaja,Ruby,Franco|Angela,Estes,Mathilda|exp:fighter_burst,jungle:fighter_jungle
Fanny|Assassin|jungle|B|Pharsa,Odette,Lunox,Kimmy|Kaja,Saber,Khufra,Franco,Chou|Tigreal,Atlas,Mathilda|assassin_phys
Layla|Marksman|gold|C|Miya,Bruno,Irithel|Saber,Natalia,Lancelot,Gusion|Angela,Diggie,Estes,Mathilda|gold:mm_crit
Minotaur|Tank,Support|roam|S|Ling,Wanwan,Gusion,Benedetta|Diggie,Valir,Kaja,Esmeralda|Pharsa,Odette,Vale,Yve,Kagura|tank_roam
Lolita|Tank,Support|roam|A|Pharsa,Kimmy,Beatrix,Granger|Valir,Kaja,Lunox,Esmeralda|Gusion,Ling,Karina|tank_roam
Hayabusa|Assassin|jungle|B|Pharsa,Miya,Layla,Beatrix|Kaja,Chou,Franco,Khufra|Tigreal,Atlas,Mathilda|assassin_phys
Freya|Fighter|exp,jungle|C|Lancelot,Layla,Miya|Esmeralda,Dyrroth,Baxia|Angela,Estes,Floryn|exp:fighter_exp,jungle:fighter_jungle
Gord|Mage|mid|A|Tigreal,Gatotkaca,Hylos|Lancelot,Gusion,Saber,Natalia|Tigreal,Atlas,Franco|mage_poke
Natalia|Assassin|roam,jungle|B|Pharsa,Miya,Layla,Beatrix|Kaja,Chou,Franco,Diggie|Tigreal,Atlas|assassin_phys
Kagura|Mage|mid|A|Lancelot,Gusion,Kagura,Nana|Saber,Natalia,Hayabusa,Kaja|Tigreal,Atlas,Kaja,Ruby|mage_burst
Chou|Fighter,Tank|exp,roam|B|Lancelot,Fanny,Ling,Gusion,Wanwan|Kaja,Valir,Ruby,Diggie|Pharsa,Odette,Lunox,Kagura|exp:fighter_burst,roam:tank_roam
Sun|Fighter|exp,jungle|S|Layla,Miya,Lancelot|Esmeralda,Dyrroth,Baxia|Angela,Mathilda,Estes|exp:fighter_exp,jungle:fighter_jungle
Alpha|Fighter|exp,jungle|C|Layla,Miya,Eudora|Esmeralda,Dyrroth,Baxia,Ruby|Angela,Estes,Floryn|exp:fighter_exp,jungle:fighter_jungle
Ruby|Fighter,Tank|exp,roam|B|Lancelot,Ling,Gusion,Fanny,Benedetta|Baxia,Esmeralda,Karrie,Dyrroth|Angela,Estes,Floryn|exp:fighter_sustain,roam:tank_roam
Yi Sun-shin|Assassin,Marksman|jungle,gold|A|Miya,Layla,Pharsa|Saber,Natalia,Chou,Kaja|Tigreal,Atlas,Mathilda|jungle:fighter_jungle,gold:mm_phys_burst
Moskov|Marksman|gold|B|Miya,Layla,Wanwan|Natalia,Saber,Lancelot,Hayabusa|Tigreal,Atlas,Angela,Estes|gold:mm_atkspd
Johnson|Tank,Support|roam|B|Pharsa,Beatrix,Granger,Kimmy|Kaja,Franco,Chou|Odette,Kagura,Vale,Pharsa|tank_roam
Cyclops|Mage|mid,jungle|C|Gusion,Lancelot,Ling,Fanny|Valir,Kaja,Chou|Tigreal,Atlas|mage_burst
Estes|Support|roam|A|Pharsa,Kagura,Lunox|Saber,Natalia,Baxia,Helcurt|Miya,Layla,Alucard,Moskov,Irithel|support_heal
Hilda|Fighter,Tank|exp,roam|C|Layla,Miya,Lancelot|Esmeralda,Dyrroth,Baxia|Angela,Estes,Floryn|exp:fighter_exp,roam:tank_roam
Aurora|Mage|mid|C|Tigreal,Fanny,Ling|Natalia,Saber,Lancelot|Tigreal,Atlas,Franco|mage_burst
Lapu-Lapu|Fighter|exp|C|Layla,Miya,Lancelot|Esmeralda,Dyrroth,Baxia|Angela,Estes,Floryn|exp:fighter_burst
Vexana|Mage|mid|B|Chou,Fanny,Ling|Natalia,Saber,Lancelot,Hayabusa|Tigreal,Atlas,Franco|mage_burst
Roger|Fighter,Marksman|jungle,gold|B|Layla,Miya,Irithel|Chou,Kaja,Franco,Valir|Tigreal,Atlas,Mathilda|jungle:fighter_jungle,gold:mm_crit
Karrie|Marksman|gold|B|Uranus,Esmeralda,Baxia,Fredrinn,Gloo|Natalia,Saber,Lancelot,Hayabusa|Tigreal,Atlas,Angela,Estes|gold:mm_atkspd
Gatotkaca|Tank,Fighter|exp,roam|C|Fanny,Ling,Lancelot,Gusion|Diggie,Kaja,Valir|Pharsa,Odette,Kagura|exp:fighter_exp,roam:tank_roam
Harley|Assassin,Mage|jungle,mid|C|Layla,Miya,Pharsa|Kaja,Ruby,Chou,Franco|Tigreal,Atlas|mage_burst
Irithel|Marksman|gold|A|Miya,Layla,Clint|Natalia,Saber,Lancelot|Estes,Angela,Rafaela|gold:mm_crit
Grock|Tank,Support|roam,exp|C|Ling,Fanny,Lancelot,Wanwan|Kaja,Diggie,Valir|Pharsa,Odette,Kagura|tank_roam
Argus|Fighter|exp|S|Layla,Miya,Eudora,Valir|Kaja,Franco,Chou,Diggie|Angela,Estes,Floryn,Rafaela|exp:argus
Odette|Mage|mid|B|Fanny,Lancelot,Ling,Hayabusa|Kaja,Ruby,Chou,Franco|Tigreal,Atlas,Johnson,Minotaur|mage_burst
Lancelot|Assassin|jungle|B|Pharsa,Miya,Layla,Beatrix,Karrie|Kaja,Chou,Khufra,Franco|Tigreal,Atlas,Mathilda|assassin_phys
Diggie|Support|roam|B|Tigreal,Atlas,Franco,Kaja,Chou|Saber,Natalia,Helcurt,Lancelot|Pharsa,Odette,Yve,Kagura|support_heal
Hylos|Tank|roam,jungle|B|Fanny,Ling,Lancelot,Gusion|Karrie,Diggie,Valir,Dyrroth|Pharsa,Odette,Yve,Moskov|tank_roam
Zhask|Mage|mid|A|Tigreal,Gatotkaca,Hylos|Lancelot,Gusion,Saber,Natalia|Tigreal,Atlas,Franco|mage_dps
Helcurt|Assassin|jungle|B|Pharsa,Miya,Layla,Estes,Rafaela|Kaja,Chou,Franco,Khufra|Tigreal,Atlas|assassin_phys
Pharsa|Mage|mid|B|Gord,Zhask,Tigreal,Atlas|Saber,Natalia,Helcurt,Lancelot,Hayabusa|Tigreal,Atlas,Minotaur,Johnson|mage_poke
Lesley|Marksman|gold,jungle|B|Miya,Layla,Pharsa,Kagura|Natalia,Saber,Lancelot,Helcurt|Angela,Tigreal,Atlas|gold:mm_phys_burst,jungle:mm_phys_burst
Jawhead|Fighter,Assassin|roam,exp|B|Miya,Layla,Pharsa,Beatrix|Diggie,Kaja,Chou,Franco|Pharsa,Odette,Yve,Kagura|roam:tank_roam,exp:fighter_burst
Angela|Support|roam|B|Saber,Natalia,Fanny,Gusion|Baxia,Lancelot,Helcurt|Alucard,Ruby,Chou,Moskov,Lancelot,Fanny|support_heal
Gusion|Assassin,Mage|jungle,mid|B|Pharsa,Odette,Lunox,Miya|Kaja,Chou,Ruby,Franco,Khufra|Tigreal,Atlas,Kaja|mage_burst
Valir|Mage|mid|S|Lancelot,Fanny,Ling,Gusion,Chou|Pharsa,Lunox,Kagura|Tigreal,Atlas,Franco|mage_poke
Martis|Fighter|jungle,exp|B|Layla,Miya,Pharsa,Odette|Kaja,Chou,Diggie,Franco|Tigreal,Atlas,Angela|jungle:fighter_jungle,exp:fighter_exp
Uranus|Tank|exp|B|Lancelot,Ling,Fanny,Alucard|Karrie,Dyrroth,Baxia,Esmeralda|Angela,Estes,Floryn|exp:tank_exp
Hanabi|Marksman|gold|A|Layla,Miya,Bruno,Gloo|Natalia,Saber,Lancelot,Helcurt|Angela,Mathilda,Diggie,Rafaela|gold:mm_crit
Chang'e|Mage|mid|C|Tigreal,Akai,Franco|Lancelot,Natalia,Saber,Hayabusa|Tigreal,Atlas,Kaja|mage_dps
Kaja|Support,Fighter|roam|B|Lancelot,Ling,Fanny,Gusion,Hayabusa|Diggie,Valir,Lylia|Gusion,Karina,Saber,Chou|tank_roam
Selena|Assassin,Mage|roam,mid|B|Pharsa,Miya,Layla,Ling|Kaja,Ruby,Chou,Franco|Tigreal,Atlas,Valir|mage_burst
Aldous|Fighter|exp|C|Layla,Miya,Eudora|Esmeralda,Dyrroth,Baxia|Angela,Estes,Floryn,Mathilda|exp:fighter_burst
Claude|Marksman|gold|B|Miya,Layla,Granger,Wanwan|Natalia,Saber,Lancelot,Helcurt|Angela,Estes,Mathilda|gold:mm_atkspd
Vale|Mage|mid|B|Gusion,Lancelot,Ling,Fanny|Saber,Natalia,Helcurt|Tigreal,Atlas,Minotaur|mage_burst
Leomord|Fighter|jungle,exp|C|Layla,Miya,Pharsa|Kaja,Chou,Franco|Tigreal,Atlas,Mathilda|jungle:fighter_jungle,exp:fighter_exp
Lunox|Mage|mid|B|Fanny,Lancelot,Ling,Gusion|Saber,Natalia,Helcurt,Hayabusa|Tigreal,Atlas,Kaja|mage_dps
Hanzo|Assassin|jungle|C|Layla,Miya,Pharsa|Kaja,Chou,Saber|Tigreal,Atlas|assassin_phys
Belerick|Tank|roam,exp|A|Karrie,Moskov,Claude,Wanwan|Valir,Diggie,Lunox|Pharsa,Odette,Kagura|tank_roam
Kimmy|Marksman,Mage|gold,mid|B|Layla,Miya,Pharsa|Natalia,Saber,Lancelot,Helcurt|Tigreal,Atlas,Angela|mm_magic
Thamuz|Fighter|exp,jungle|C|Layla,Miya,Lancelot|Esmeralda,Baxia,Karrie|Angela,Estes,Floryn|exp:fighter_exp,jungle:fighter_jungle
Harith|Mage|gold,mid|B|Lancelot,Gusion,Ling,Fanny|Kaja,Saber,Natalia,Chou|Angela,Tigreal,Atlas|mage_dps
Minsitthar|Fighter|roam,exp|C|Fanny,Ling,Lancelot,Benedetta|Diggie,Kaja,Valir|Pharsa,Odette,Kagura|roam:tank_roam,exp:fighter_exp
Kadita|Mage,Assassin|roam,mid|A|Ling,Gusion,Wanwan,Miya|Kaja,Ruby,Chou,Franco|Pharsa,Odette,Yve|mage_burst
Faramis|Mage,Support|roam,mid|B|Saber,Natalia,Lancelot|Baxia,Esmeralda,Valir|Ruby,Alucard,Moskov,Yu Zhong|mage_sustain
Badang|Fighter|exp,jungle|C|Layla,Miya,Lancelot|Kaja,Diggie,Valir|Tigreal,Atlas|exp:fighter_burst,jungle:fighter_jungle
Khufra|Tank,Support|roam|S|Fanny,Ling,Lancelot,Wanwan,Hayabusa|Diggie,Valir,Kaja,Lylia|Pharsa,Odette,Yve,Kagura|tank_roam
Granger|Marksman|gold,jungle|B|Pharsa,Miya,Layla,Kagura|Natalia,Saber,Lancelot,Chou|Tigreal,Atlas,Angela|gold:mm_phys_burst,jungle:mm_phys_burst
Guinevere|Fighter,Mage|exp,jungle|B|Lancelot,Pharsa,Odette,Lunox|Kaja,Chou,Franco,Diggie|Tigreal,Atlas,Kaja|exp:fighter_magic,jungle:fighter_magic
Esmeralda|Mage,Tank|exp,jungle|B|Alice,Uranus,Hylos,Gatotkaca,Ruby|Karrie,Baxia,Valir,Dyrroth|Angela,Estes,Floryn|exp:fighter_magic,jungle:fighter_magic
Terizla|Fighter|exp|C|Layla,Miya,Pharsa|Dyrroth,Esmeralda,Baxia|Atlas,Tigreal,Mathilda|exp:fighter_sustain
X.Borg|Fighter|exp|B|Esmeralda,Ruby,Uranus,Hylos|Baxia,Karrie,Dyrroth|Angela,Estes,Floryn|exp:xborg
Ling|Assassin|jungle|A|Pharsa,Miya,Layla,Kagura|Kaja,Chou,Khufra,Franco|Tigreal,Atlas,Mathilda|assassin_phys
Dyrroth|Fighter|exp,jungle|B|Uranus,Esmeralda,Ruby,Alucard,Freya|Kaja,Chou,Franco,Baxia|Tigreal,Atlas,Angela|exp:fighter_burst,jungle:fighter_jungle
Lylia|Mage|mid|B|Tigreal,Franco,Kaja,Khufra|Saber,Natalia,Lancelot,Helcurt|Tigreal,Atlas,Mathilda|mage_dps
Baxia|Tank|jungle,roam|B|Esmeralda,Ruby,Alucard,Estes,Angela|Karrie,Valir,Diggie|Pharsa,Odette,Moskov|tank_exp
Masha|Fighter,Tank|exp|S|Ruby,Uranus,Esmeralda,Lukas|Karrie,Dyrroth,Baxia,Phoveus|Angela,Floryn,Estes,Rafaela|exp:masha
Wanwan|Marksman|gold|B|Miya,Layla,Pharsa,Gusion|Minotaur,Khufra,Akai,Tigreal|Angela,Mathilda,Atlas|gold:mm_atkspd
Silvanna|Fighter|exp|C|Layla,Miya,Pharsa|Diggie,Kaja,Baxia|Pharsa,Odette,Kagura|exp:fighter_magic
Cecilion|Mage|mid|B|Tigreal,Franco,Khufra,Hylos|Saber,Natalia,Lancelot,Helcurt|Carmilla,Tigreal,Atlas|mage_dps
Carmilla|Support,Tank|roam|S|Saber,Natalia,Lancelot|Diggie,Valir,Kaja|Cecilion,Pharsa,Odette,Yve|tank_roam
Atlas|Tank|roam|A|Ling,Fanny,Lancelot,Wanwan,Gusion|Diggie,Kaja,Valir,Lylia|Pharsa,Odette,Yve,Vale,Kagura|tank_roam
Popol and Kupa|Marksman|gold|S|Miya,Layla,Ling|Natalia,Saber,Lancelot|Tigreal,Atlas,Angela|gold:mm_atkspd
Yu Zhong|Fighter|exp|A|Ruby,Esmeralda,Uranus,Alucard|Karrie,Baxia,Dyrroth|Angela,Estes,Floryn|exp:fighter_burst
Luo Yi|Mage|mid|B|Tigreal,Franco,Khufra|Saber,Natalia,Lancelot,Helcurt|Tigreal,Atlas,Minotaur,Johnson|mage_poke
Benedetta|Assassin,Fighter|exp,jungle|A|Layla,Miya,Pharsa,Esmeralda|Kaja,Chou,Ruby,Minsitthar|Tigreal,Atlas,Angela|exp:fighter_burst,jungle:fighter_jungle
Khaleed|Fighter|exp|C|Layla,Miya,Pharsa|Esmeralda,Baxia,Karrie|Angela,Estes,Floryn|exp:fighter_exp
Barats|Tank,Fighter|jungle,exp|B|Lancelot,Ling,Fanny|Karrie,Diggie,Valir|Pharsa,Odette,Yve|tank_exp
Brody|Marksman|gold|A|Miya,Layla,Wanwan,Kimmy|Natalia,Saber,Lancelot,Helcurt|Tigreal,Atlas,Angela,Mathilda|gold:mm_phys_burst
Yve|Mage|mid|A|Tigreal,Franco,Khufra,Akai|Saber,Natalia,Lancelot,Helcurt|Tigreal,Atlas,Minotaur,Khufra|mage_dps
Mathilda|Support,Assassin|roam|B|Pharsa,Kagura,Miya,Layla|Saber,Natalia,Kaja|Ling,Fanny,Lancelot,Gusion,Hayabusa|support_heal
Paquito|Fighter|exp|A|Layla,Miya,Lancelot|Kaja,Ruby,Chou,Franco|Angela,Estes,Floryn|exp:fighter_burst
Gloo|Tank|exp,roam|S|Ling,Fanny,Lancelot,Gusion|Karrie,Dyrroth,Valir|Pharsa,Odette,Yve|exp:tank_exp,roam:tank_roam
Beatrix|Marksman|gold|A|Miya,Layla,Pharsa,Tigreal|Natalia,Saber,Lancelot,Helcurt|Tigreal,Atlas,Angela,Mathilda|gold:mm_phys_burst
Phoveus|Fighter|exp|B|Fanny,Ling,Lancelot,Chou,Wanwan|Baxia,Karrie,Dyrroth|Angela,Estes,Floryn|exp:fighter_exp
Natan|Marksman|gold|B|Miya,Layla,Tigreal|Natalia,Saber,Lancelot,Helcurt|Tigreal,Atlas,Angela|mm_magic
Aulus|Fighter|exp,jungle|S|Layla,Miya,Pharsa|Kaja,Chou,Diggie,Franco|Angela,Estes,Floryn|exp:fighter_exp,jungle:fighter_jungle
Aamon|Assassin|jungle|B|Pharsa,Miya,Layla,Kagura|Kaja,Chou,Khufra,Franco|Tigreal,Atlas,Mathilda|mage_burst
Valentina|Mage|mid|B|Pharsa,Odette,Lunox,Kagura|Saber,Natalia,Lancelot|Tigreal,Atlas,Mathilda|mage_burst
Edith|Tank,Marksman|exp,roam|A|Ling,Fanny,Lancelot,Gusion|Diggie,Valir,Karrie|Pharsa,Odette,Yve|exp:tank_exp,roam:tank_roam
Floryn|Support|roam|S|Pharsa,Kagura,Lunox|Saber,Natalia,Baxia,Helcurt|Ruby,Alucard,Moskov,Yu Zhong,Karrie|support_heal
Yin|Fighter,Assassin|exp,jungle|B|Layla,Miya,Pharsa,Beatrix|Diggie,Kaja,Chou,Franco|Tigreal,Atlas,Angela|exp:fighter_burst,jungle:fighter_jungle
Melissa|Marksman|gold|C|Ling,Lancelot,Gusion,Hayabusa,Fanny|Natalia,Saber,Helcurt|Tigreal,Atlas,Angela,Mathilda|gold:mm_atkspd
Xavier|Mage|mid|B|Tigreal,Franco,Khufra|Saber,Natalia,Lancelot,Helcurt|Tigreal,Atlas,Minotaur|mage_poke
Julian|Fighter,Mage|jungle,exp|B|Layla,Miya,Pharsa|Kaja,Chou,Ruby,Franco|Tigreal,Atlas,Angela|jungle:fighter_jungle,exp:fighter_burst
Fredrinn|Tank,Fighter|jungle,exp|A|Lancelot,Ling,Fanny,Benedetta|Karrie,Dyrroth,Baxia,Valir|Pharsa,Odette,Yve,Moskov|jungle:tank_exp,exp:tank_exp
Joy|Assassin|jungle|B|Pharsa,Miya,Layla,Kagura|Kaja,Chou,Minsitthar,Franco|Tigreal,Atlas,Mathilda|mage_burst
Novaria|Mage|mid|B|Pharsa,Miya,Layla,Granger|Saber,Natalia,Lancelot,Helcurt|Tigreal,Atlas,Minotaur|mage_poke
Arlott|Fighter,Assassin|exp,roam,jungle|A|Lancelot,Ling,Fanny,Benedetta|Kaja,Chou,Ruby,Baxia|Pharsa,Odette,Kagura,Tigreal|exp:fighter_burst,roam:tank_roam,jungle:fighter_jungle
Ixia|Marksman|gold|B|Tigreal,Franco,Gloo,Uranus|Natalia,Saber,Lancelot,Helcurt|Tigreal,Atlas,Mathilda,Angela|gold:mm_atkspd
Nolan|Assassin|jungle|A|Pharsa,Miya,Layla,Kagura|Kaja,Chou,Khufra,Franco|Tigreal,Atlas,Mathilda|assassin_phys
Cici|Fighter|exp|B|Lancelot,Ling,Fanny|Kaja,Chou,Ruby,Franco|Angela,Estes,Floryn|exp:fighter_sustain
Chip|Tank,Support|roam|B|Ling,Fanny,Lancelot,Wanwan|Diggie,Kaja,Valir|Pharsa,Odette,Yve,Moskov|tank_roam
Zhuxin|Mage|mid|A|Tigreal,Franco,Khufra,Fanny|Saber,Natalia,Lancelot,Helcurt|Tigreal,Atlas,Minotaur|mage_dps
Suyou|Assassin,Fighter|jungle,exp|B|Pharsa,Miya,Layla,Kagura|Kaja,Chou,Ruby,Franco|Tigreal,Atlas,Mathilda|jungle:fighter_jungle,exp:fighter_burst
Lukas|Fighter|exp,jungle|A|Layla,Miya,Pharsa,Lancelot|Kaja,Chou,Baxia,Karrie|Angela,Estes,Floryn|exp:fighter_sustain
Kalea|Support,Fighter|roam|B|Saber,Natalia,Lancelot|Diggie,Kaja,Valir|Pharsa,Odette,Yve|tank_roam
Zetian|Mage|mid|A|Tigreal,Franco,Khufra|Saber,Natalia,Lancelot,Helcurt|Tigreal,Atlas,Minotaur|mage_poke
Obsidia|Marksman|gold|S|Miya,Layla,Tigreal|Natalia,Saber,Lancelot,Helcurt|Tigreal,Atlas,Angela|gold:mm_crit
Sora|Fighter|exp,jungle|B|Layla,Miya,Pharsa|Kaja,Chou,Ruby|Angela,Estes,Floryn|exp:fighter_burst,jungle:fighter_jungle
Marcel|Tank,Support|roam|S|Ling,Fanny,Lancelot|Diggie,Kaja,Valir|Pharsa,Odette,Yve|tank_roam
Hirara|Assassin|jungle,exp|S|Pharsa,Miya,Layla,Kagura|Phoveus,Minsitthar,Kalea,Saber,Odette,Bruno|Tigreal,Atlas,Marcel,Khufra|hirara
`;

const META_INFO = {
  updated: "2026-11-01",
  patch: "Season 42 · Patch 2.2.16a",
  sources: [
    ["mlbbhub.com — טיר ליסט וסטטיסטיקה", "https://mlbbhub.com/tier-list"],
    ["timesaver.gg — טיר ליסט Season 42", "https://timesaver.gg/blog/mobile-legends-tier-list-season-42"],
    ["mlbbdex.com — דוח מטא שבועי לפי ליין", "https://mlbbdex.com/en/meta"],
    ["elitedias.com — טיר ליסט Mythical Glory+ (Liquipedia + mlbbhub)", "https://elitedias.com/en/tools/mlbb-tier-list"],
    ["mlbb.io — Hirara: קאונטרים", "https://mlbb.io/en/hero/hirara"],
  ],
};

const ROLE_HE = { Tank: "טנק", Fighter: "פייטר", Assassin: "מתנקש", Mage: "מאג'", Marksman: "מרקסמן", Support: "תומך" };
const LANE_HE = { gold: "גולד ליין", exp: "EXP ליין", mid: "מיד ליין", jungle: "ג'ונגל", roam: "רואם" };
const LANES = ["gold", "exp", "mid", "jungle", "roam"];

function normName(n) { return String(n || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

const HEROES = HERO_ROWS.trim().split("\n").map((line) => {
  const [name, roles, lanes, tier, strong, weak, syn, build] = line.split("|");
  const list = (s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);
  const builds = {};
  const laneList = list(lanes);
  if (build.includes(":")) {
    build.split(",").forEach((p) => { const [l, t] = p.split(":"); builds[l] = t; });
  } else laneList.forEach((l) => (builds[l] = build));
  laneList.forEach((l) => { if (!builds[l]) builds[l] = Object.values(builds)[0]; });
  return { name, key: normName(name), roles: list(roles), lanes: laneList, metaTier: tier,
    strongAgainst: list(strong), weakAgainst: list(weak), synergy: list(syn), builds };
});
const HERO_BY_KEY = Object.fromEntries(HEROES.map((h) => [h.key, h]));
