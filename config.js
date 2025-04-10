exports.startupCheats = [];

exports.cheatConfig = {
  unban: true,
  dungeon: {
    creditcap: 10000000, // lots of people breaking things by having too many credits
    flurbocap: 1000000,
  },
  multiply: {
    damage: 1,
    efficiency: 1,
    afk: 1,
    drop: 1,
    printer: 6,
    monsters: 1,
  },
  godlike: {
    respawn: (t) => Math.min(t, 1),
  },
  nomore: {
    items: [],
  },
  unlock: {
    islands: "abcde_",
  },
  wide: {
    gembuylimit: 0,
    autoloot: {
      tochest: true,
      hidenotifications: true,
    },
    perfectobols: {
      preferredstat: "PRIMARY", // PRIMARY, STR, AGI, WIS or LUK
    },
    plunderous: {
      allcharacters: false,
    },
  },
  wipe: {
    cogs: 0,
  },
  cauldron: {
    liq_rate: (t) => 100000,
  },
  talent: {
    168: (t) => t * 2, // orb of remembrance time doubled,
    169: (t) => 100, // 100% shockwave
    318: (t) => 10000, // 10x hp/drop plunderous mobs
    120: (t) => 800, // 800% shockwave damage
    483: (t) => Math.max(t, 3.5), // Tenteycle
    // 1: time? 2: points?
    45: (t, args) => { const fns = { 1: (t) => t, 2: (t) => t }; const fn = fns[args[0]]; return fn ? fn(t) : 0; },
  },
  w1: {
    anvil: {
      productionspeed: (t) => 5000000,
    },
    companion: {
      companions: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20, 21, 22, 23, 24, 25, 26
      ], // Set the companions you have unlocked (0=doot, down to 23=green mush)
      current: "11", //current companion - Glunko Supreme
    },
  },
  w4: {
    fastforaging: (t) => 3e8,
    superpets: {
      BlockChance: (t) => 100,
      TotalDMG: (t) => t * 5000,
    },
    mainframe: {
      0: (t) => 200, // Animal farm damage bonus (119 is all pets)
      1: (t) => 2, // Wired in uploaded player printer multiplier
      2: (t) => 10, // Refinery cycle speed multiplier
      3: (t) => 10, // alch bubble level gain (game subtracts 1 from this number, and affects min(this number, 4) + up to 2 more bubbles from sailing for a max of 6)
      4: (t) => 2, // Deathnote/portal kill multiplier
      5: (t) => 1, // Shrine world tour activated
      6: (t) => 5, // Alchemy liquid capacity multi (-30% speed)
      7: (t) => 2, // Stamp bonus multiplier (must be equal to 2 to work)
      8: (t) => 5, // Spelunker jewel effect multiplier
      9: (t) => t * 2, // Fungi finger pocketer %cash bonus
      10: (t) => 2, // Alchemy vial bonus multiplier
      11: (t) => t * 1.2, // Banking fury, %damage multiplier
      12: (t) => 1, // enable sigils (this is either 1 or 0)
      13: (t) => 300, // % larger connection range
      100: (t) => 10, // meal cooking speed multiplier
      101: (t) => 3, // Animal farm additional damage % per pet
      102: (t) => 60, // additional % lab xp
      103: (t) => 36, // trim all building slots
      104: (t) => 15, // % all stat
      105: (t) => 100, //additional breeding xp
      106: (t) => 10, // kitchens gain a level each day
      107: (t) => 2, // adds to bonus 3
      108: (t) => 50, // % food non consume chance
      109: (t) => 145, // % larger connection range for bonuses and jewels
      110: (t) => 100, // % extra damage
      111: (t) => 500, // % reduced egg incubation
      112: (t) => 1500, // +base efficiency in all skills
      113: (t) => 1.5, //fungi finger pocketer extra cash %
      114: (t) => t * 3, //meal cooking bonus speed %
      115: (t) => 45, //pet passive ability speed %
      116: (t) => 50, // % additional meal bonus
      117: (t) => 1.5, // % additional damage per greened stack
    },
    chipbonuses: {
      resp: (t) => 50, //mob respawn speed bonus
      card1: (t) => 1, //double top left card effect (1=yes, 0=no)
      card2: (t) => 1, //double bottom right card effect (1=yes, 0=no)
      crys: (t) => 95, //crystal spawn % on kill
      star: (t) => 1, //double star sign effects (1=yes, 0=no)
      mkill: (t) => 40, //% multikill per tier bonus
      linewidth: (t) => 12, //lab line width % bonus
      dmg: (t) => 100, //% damage bonus
      move: (t) => 30, //mpvement speed bonus,
      acc: (t) => 30, //accuracy bonus
      pend: (t) => 1, //double pendant bonuses
      key1: (t) => 1, //double first keychain bonuses
      troph: (t) => 1, //souble trophy bonuses
      def: (t) => 10, //bonus defence %
      weappow: (t) => 100, //bonus weapon power %
      dr: (t) => 60, //bonus drop rarity %
      toteff: (t) => 40, //% skilling efficiency bonus
      eff: (t) => 1200, //base skilling efficiency bonus
      labexp: (t) => 150, //% bonus lab xp
      atkspd: (t) => 60, //% bonus attack speed
      safk: (t) => 15, //skill afk gains bonus %
      fafk: (t) => 25, //fight afk gains bonus %
    },
    meals: {
      TotDmg: (t) => t,
      Mcook: (t) => t,
      Cash: (t) => t,
      Rcook: (t) => t,
      Npet: (t) => t,
      BrExp: (t) => t,
      Seff: (t) => t,
      VIP: (t) => t,
      Lexp: (t) => t,
      Def: (t) => t,
      PxLine: (t) => t,
      KitchenEff: (t) => t,
      TimeEgg: (t) => t,
      KitchC: (t) => t,
      PetDmg: (t) => t,
      TDpts: (t) => t,
      CookExp: (t) => t,
      Breed: (t) => t,
      TotAcc: (t) => t,
      AtkSpd: (t) => t,
      Sprow: (t) => t,
      Lib: (t) => t,
      Critter: (t) => t,
      Crit: (t) => t,
      LinePct: (t) => t,
      TPpete: (t) => t,
      Liquid12: (t) => t,
      DivExp: (t) => t,
      GamingBits: (t) => t,
      Liquid34: (t) => t,
      Sailing: (t) => t,
      GamingExp: (t) => t,
    },
  },
  w5: {
    sailing: {
      IslandDistance: (t) => t / 2, // islands 50% closer
      MaxChests: (t) => t, // ! Caution if the pile is too high the game wont save to the cloud anymore !
      RareTreasureChance: (t) => t * 5, // 5x chance for rare treasure
      Minimumtraveltime: (t) => t / 5, // minimum travel time reduced from 2h to 30m ( t => 10 would be 10 minues )
      BoatUpgCostType: (t) => t, // loot type for upgrade
      BoatUpgCostQty: (t) => t, // loot amount for upgrade, t => 0 for free upgrades
      BoatValue: (t) => t * 2, // 2x boat loot
      BoatSpeed: (t) => t * 2, // 2x boat speed
      CloudDiscoverBonus: (t) => t * 2, // 2x cloud discover bonus
      ArtifactChance: (t) => t, // ! Caution changing this causes crashes. ! artifact discover bonus (lower is better)
      AncientChances: (t) => t / 5, // 5x ancient chance (lower is better)
      EldritchChances: (t) => t, // eldritch chance (is lower is better?)
      SovereignChances: (t) => t, // sovereign chance (is lower is better?)
      NewCaptBoatSlot: (t) => 0, // free boat and captain slots
      BuyCaptainCost: (t) => 0, // free captains
      ArtifactBonus: (t) => t, // bonus from the artifact, needs investigation as to what can be done here!
    },
    gaming: {
      FertilizerUpgCosts: (t) => 0, // fertilizer upgrade costs are free
      SproutCapacity: (t) => Math.max(22, t + 2), // 2 more sprout slots, or 22 if that's higher
      MutateUpgCosts: (t) => 0, // mutate upgrade costs are free
      LogBookBitBonus: (t) => Math.max(20, t * 2), // 2x logbook bits bonus, or 20 if that's higher
      GamingExpPCT: (t) => t * 1.5, // 1x gaming exp multiple
      NewMutantChanceDEC: (t) => 1, // new mutant guaranteed
      SproutGrowthCHANCEperMUT: (t) => t, // could be a bit fiddly, i assume this gives the chance of each plant type growing
      SproutGrowthTime: (t) => t / 5, // sprouts grow 5x faster
      SaveSprinkler: (t) => t * 1.1, // Don't use water when using the sprinkler. 1 is a guarantee
      ImportItemCOST: (t) => 0, // import item upgrades are free
      AcornShopCost: (t) => 0, //acorn shop upgrades are free
      BoxCost: (t) => 0, //new boxes are free
      // 0: upgrade chance 1: reset chance 2: bit multiplier
      SnailStuff: (t, args) => { const fns = { 0: (t) => 1, 1: (t) => 0, 2: (t) => t }; return fns[args[1]] ? fns[args[1]](t) : 0; },
      SnailMail: false,
    },
    divinity: {
      unlinks: true,
      StyleLvReq: (t) => 0, // allow all meditation styles from lvl 0
      DivPerHr: (t) => t * 3, // base div per hr
      DivPerHr_EXP: (t) => t * 3, // base xp per hr
      BlesssBonus: (t) => t * 2, // god blessing bonus
      Bonus_MAJOR: (t) => t, // main bonus
      Bonus_Minor: (t) => t * 2, // passive bonus
      OfferingCost: (t) => 0, // free offerings
      OfferingOdds: (t) => 1, //offerings always work
    },
    collider: {
      AtomsUnlocked: (t) => t, // max 10
      AtomCost: (t) => 0, // atom collider upgrades are free,
      AtomBonuses: (t) => t, // atom bonus amount. Unclear how this works yet, assume t => t * 2 would be 2x regular bonus
      AtomBubbleUpgCost: (t) => 0, // atom bubble upgrades are free,
    },
    holes: {
      VillagerExpPerHour: (t) => t * 2, // 2x villager exp
      BuildCost: (t) => t / 2, // building upgrades are 0.5x cost
      BucketFillRate: (t) => t * 2, // 2x bucket fill rate
      AmpMulti: (t) => t * 2, // 2x amp multiplier
      MeasurementCost: (t) => t / 2, // measurement upgrades are 0.5x cost
      MeasurementBaseBonus: (t) => t * 2, // 2x measurement base bonus
      MotherlodeEffBase: (t) => t / 2, // 0.5 motherlode efficiency
      MonumentRewardMulti: (t) => t * 2, // 2x bravery reward multiplier this is the time multiplier
      MonumentROGbonuses: (t) => t * 2, // 2x bravery right side rewards
      // MonumentHRbonuses: t => t * 2, // 2x bravery left side rewards
      Bravery_MinDMG: (t) => t * 10, // 10x bravery min damage
      Bravery_MaxDMG: (t) => t * 2, // 2x bravery max damage
      Bravery_SwordsOwned: (t) => 8, // 8 swords for bravery 10 swords glitch out
      MaxRerolls: (t) => 20, // 20 rerolls for bravery
      MaxRevisions: (t) => 5, // 5 revisions for bravery
      Bravery_MonsterHP: (t) => t / 2, // 0.5 x monster hp
      Bravery_BlueChestChanceDEC: (t) => 0.5, // 50% blue chest chance. Those are really rare 0.001% its like double loot.
      BellCosts: (t) => t / 2, // bell improvements are 0.5x cost
      BellBonuss: (t) => t * 2, // 2x bell bonus from first bell
      BellExpPerHR: (t) => t * 2, // 2x all bell exp
      BellEXPreq: (t) => t / 2, // 0.5x bell uses cost.
      HarpNewNote_Cost: (t) => t / 2, // harp new note cost is 0.5x
      HarpNoteProduced: (t) => t * 2, // 2x harp note produced
      HarpPOWperHR: (t) => t * 10, // 10x harp power per hr
      LampWishCost: (t) => t / 2, // lamp wish cost is 0.5x
      LampWishPerDay: (t) => t * 2, // 2x lamp wish per day
      MushKillsLeft: (t) => 0, // always able to kill boss.
      J_StartCoins: (t) => t * 5, // justice start with 5x coins
      J_Happiness: (t) => t * 5, // justice start with 5x happiness
      J_Dismissals: (t) => t * 5, // justice start with 5x dismissals
      J_StartHealth: (t) => t * 5, // justice start with 5x health
      Justice_BlueChestChanceDEC: (t) => 0.5, // 50% blue chest chance. Those are really rare 0.001% its like double loot.
      // New bonuses 13.03.2024
      BolaiaStudyRate: (t) => t * 2, // 2x bolaia study rate
      JarProductionPerHR: (t) => t * 2, // 2x jar production rate
    },
    fixobj: false,
  },
  w6: {
    farming: {
      GrowthReq: (t) => t / 5, // time for plants to grow (base is 4 hours * 1.5 ^ seedtype (0 for basic, etc))
      OGunlocked: (t) => t, //if overgrowth unlocked in shop (0 -> locked, 1 -> unlocked)
      NextOGchance: (t) => t * 5, // chance to get next OG multi (5x chance)
      OGmulti: (t) => (t == 1 ? 1 : Math.max(1, t * 2)), // OG bonus multiplier (1 -> no multiplier, 2 -> 2x, 4 -> 4x, etc) minimum is 1x to prevent bricking
      PlotOwned: (t) => Math.min(36, t + 2), // number of plots owned, additional two plots to your farm, max is 36
      MarketCostType: (t) => t, // plant type for upgrade
      MarketCostQTY: (t) => Math.floor(t / 5), // plant amount for upgrade, t => 0 for free upgrades
      NextCropChance: (t) => t * 2, // chance to get next plant evo level (2x chance)
      CropsBonusValue: (t) => t * 2, // how much each crop is worth (2x)
      CropsOnVine: (t) => t * 2, // 2 x Num of crops on each plant
      GrowthRate: (t) => t, // Growth rate multiplier (growth increase/sec)
    },
    ninja: {
      EmporiumCost: (t) => t / 5, // emporium cost are 5x cheaper
      KOtime: (t) => t / 5, // KO time 5x shorter (lower is better)
      ActionSpd: (t) => t * 2, // Action speed 2x faster
      Stealth: (t) => t * 2, // Stealth 2x more
      DetectionDEC: (t) => t / 5, // Detection rate 5x lesser (lower is better)
      DoorMaxHP: (t) => t, // Door HP
      JadeUpgCost: (t) => t, // Jade upgrades cost 5x cheaper (lower is better), t => 0 for free upgrades
      ItemStat: (t) => t * 2, // 2x Item stats
      ItemFindOdds: (t) => t * 2, // 2x Item find rate
      PristineBon: (t) => t, // 2x Pristine Bon stats
    },
    summoning: {
      ManaStart: (t) => t, // starting mana (can be t * 2 for 2x current start or t => 10)
      ManaRegen: (t) => t * 2, // 2x mana regen rate
      UnitSpd: (t) => t, // set own unit speed
      UnitHP: (t) => t * 2, // 2x unit HP
      UnitDMG: (t) => t * 2, // 2x unit damage
      UnitDODGE: (t) => Math.min(1, t * 2), // 2x dodge rate max of 1
      EndlessUnlocked: (t) => 1, // unlock endless mode
      SummUpgBonus: (t) => t * 2, // 2x value of all summoning upgrade bonuses
      SummRockEssGen: (t) => t * 1.5, // 1.5x essence gain for all colours
      UpgCost: (t) => t / 2, // t => 0 for free upgrades
      UnitCost: (t) => Math.ceil(t / 2), // halved unit cost (lower is better)
      RerollCost: (t) => 0, // summon unit cost always 0
      SummEXPgain: (t) => t, // increase summoning exp gain
      EnemyHP: (t) => t / 2, // halved enemy hp
      EnemyDMG: (t) => t / 2, // halved enemy dmg
      EnemySpd: (t) => t, // set enemy unit speed
    },
    grimoire: {
      GrimoireUpgCost: (t) => t / 2, // grimoire upgrade costs are halfed, set this to 0 for free upgrades
    },
  },
  misc: {
    keychain: (t) => t,
  },
};

exports.injectorConfig = {
  injreg: "\\w+\\.ApplicationMain\\s*?=",
  interceptPattern: "*N.js",
  showConsoleLog: true,
  chrome: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  enableUI: true,
};
