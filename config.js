exports.startupCheats = [];

exports.cheatConfig = {
	unban: true,
	dungeon: {
		creditcap: 50000000, // lots of people breaking things by having too many credits
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
		respawn: t => Math.min(t, 1),
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
		cogs: 0
	},
	cauldron: {
		liq_rate: t => 100000,
	},
	talent: {
		168: t => t * 2, // orb of remembrance time doubled,
		169: t => 100, // 100% shockwave
		318: t => 10000, // 10x hp/drop plunderous mobs
		120: t => 800, // 800% shockwave damage
		483: t => Math.max(t, 3.5), // Tenteycle 
		45: (t, args) => {
			return {
				1: t => t, // time?
				2: t => t  // points?
			}[args[0]](t)
		},
	},
	w1: {
		anvil: {
			productionspeed: t => 5000000,
		},
		companion: {
			companions: [0,1,2,3,4,5,6,7,8,9,10], // Set the companions you have unlocked (0=doot, down to 10=frog)
			current: "0", //current companion - doot
		},
	},
    w4: {
        fastforaging: t => 3e7,
        superpets: {
            'BlockChance': t => 100,
            'TotalDMG': t => t * 5000,
        },
		mainframe: {
			0	: t => 200, // Animal farm damage bonus (119 is all pets) 
			1	: t => 2, // Wired in uploaded player printer multiplier
			2	: t => 10, // Refinery cycle speed multiplier
			3	: t => t, // alch bubble level gain (game subtracts 1 from this number, and affects min(this number, 4) + up to 2 more bubbles from sailing for a max of 6)
			4	: t => 2, // Deathnote/portal kill multiplier
			5	: t => 1, // Shrine world tour activated
			6	: t => 5, // Alchemy liquid capacity multi (-30% speed)
			7	: t => 2, // Stamp bonus multiplier (must be equal to 2 to work)
			8	: t => 5,	// Spelunker jewel effect multiplier
			9	: t => t * 2, // Fungi finger pocketer %cash bonus
			10	: t => 2, // Alchemy vial bonus multiplier
			11	: t => t * 1.2, // Banking fury, %damage multiplier
			12	: t => 1, // enable sigils (this is either 1 or 0)
			13	: t => 300, // % larger connection range
			100	: t => 10, // meal cooking speed multiplier
			101	: t => 3, // Animal farm additional damage % per pet
			102	: t => 60, // additional % lab xp
			103	: t => 36, // trim all building slots
			104	: t => 15, // % all stat
			105	: t => 100, //additional breeding xp
			106	: t => 10, // kitchens gain a level each day
			107	: t => 2, // adds to bonus 3
			108	: t => 50, // % food non consume chance
			109	: t => 145, // % larger connection range for bonuses and jewels
			110	: t => 100, // % extra damage
			111	: t => 500, // % reduced egg incubation
			112	: t => 1500, // +base efficiency in all skills
			113	: t => 1.5, //fungi finger pocketer extra cash %
			114	: t => t * 3, //meal cooking bonus speed %
			115	: t => 45, //pet passive ability speed %
			116	: t => 50, // % additional meal bonus
			117	: t => 1.5 // % additional damage per greened stack
		},
		chipbonuses: {
			"resp"		: t => 50, //mob respawn speed bonus
			"card1"		: t => 1, //double top left card effect (1=yes, 0=no)
			"card2"		: t => 1, //double bottom right card effect (1=yes, 0=no)
			"crys"		: t => 95, //crystal spawn % on kill
			"star"		: t => 1, //double star sign effects (1=yes, 0=no)
			"mkill"		: t => 40, //% multikill per tier bonus
			"linewidth"	: t => 12, //lab line width % bonus
			"dmg"		: t => 100, //% damage bonus
			"move"		: t => 30, //mpvement speed bonus,
			"acc"		: t => 30, //accuracy bonus
			"pend"		: t => 1, //double pendant bonuses
			"key1"		: t => 1, //double first keychain bonuses
			"troph"		: t => 1, //souble trophy bonuses
			"def"		: t => 10, //bonus defence %
			"weappow"	: t => 100, //bonus weapon power %
			"dr"		: t => 60, //bonus drop rarity %
			"toteff"	: t => 40, //% skilling efficiency bonus
			"eff"		: t => 1200, //base skilling efficiency bonus
			"labexp"	: t => 150, //% bonus lab xp
			"atkspd"	: t => 60, //% bonus attack speed
			"safk"		: t => 15, //skill afk gains bonus %
			"fafk"		: t => 25, //fight afk gains bonus %
		},
		meals: {
			TotDmg: t => t,
			Mcook: t => t,
			Cash: t => t,
			Rcook: t => t,
			Npet: t => t,
			BrExp: t => t,
			Seff: t => t,
			VIP: t => t,
			Lexp: t => t,
			Def: t => t,
			PxLine: t => t,
			KitchenEff: t => t,
			TimeEgg: t => t,
			KitchC: t => t,
			PetDmg: t => t,
			TDpts: t => t,
			CookExp: t => t,
			Breed: t => t,
			TotAcc: t => t,
			AtkSpd: t => t,
			Sprow: t => t,
			Lib: t => t,
			Critter: t => t,
			Crit: t => t,
			LinePct: t => t,
			TPpete: t => t,
			Liquid12: t => t,
			DivExp: t => t,
			GamingBits: t => t,
			Liquid34: t => t,
			Sailing: t => t,
			GamingExp: t => t,
		},
	},
	w5: {
		sailing: {
			IslandDistance: t => t / 2, // islands 50% closer
			MaxChests: t => 100, // pile holds 100000 chests
			RareTreasureChance: t => t * 5, // 5x chance for rare treasure
			Minimumtraveltime: t => t / 4, // minimum travel time reduced from 2h to 30m ( t => 10 would be 10 minues )
			BoatUpgCostType: t => t, // loot type for upgrade
			BoatUpgCostQty: t => t, // loot amount for upgrade, t => 0 for free upgrades
			boatValue: t => t * 2, // 2x boat loot
			BoatSpeed: t => t * 2, // 2x boat speed
			BoatArtiMulti: t => t * 2, //Artifact discover chanc
			CloudDiscoverBonus: t => t * 2, // 2x cloud discover bonus
			NewCaptBoatSlot: t => 0, // free boat and captain slots
			BuyCaptainCost: t => 0, // free captains
			ArtifactBonus: t => t // bonus from the artifact, needs investigation as to what can be done here!
		},
		gaming: {
			FertilizerUpgCosts: t => 0, // fertilizer upgrade costs are free
			SproutCapacity: t => Math.max(22, t + 2), // 2 more sprout slots, or 22 if that's higher
			MutateUpgCosts: t => 0, // mutate upgrade costs are free
			LogBookBitBonus: t => Math.max(20, t * 2), // 2x logbook bits bonus, or 20 if that's higher
			GamingExpPCT: t => t * 1.5, // 1x gaming exp multiple
			NewMutantChanceDEC: t => 1, // new mutant guaranteed
			SproutGrowthCHANCEperMUT: t => t, // could be a bit fiddly, i assume this gives the chance of each plant type growing
			SproutGrowthTime: t => t / 5, // sprouts grow 5x faster
			SaveSprinkler: t => t * 1.1, // Don't use water when using the sprinkler. 1 is a guarantee
			ImportItemCOST: t => 0, // import item upgrades are free
			AcornShopCost: t => 0, //acorn shop upgrades are free
			BoxCost: t => 0, //new boxes are free
			SnailStuff: (t, args) => {
				return {
					0: t => t, // upgrade chance
					1: t => 0, // reset chance
					2: t => t  // bit multiplier
				}[args[1]](t)
			},
			SnailMail: false,
		},
		divinity: {
			unlinks: true,
			StyleLvReq: t => 0, // allow all meditation styles from lvl 0
			DivPerHr: t => t * 3, // base div per hr
			DivPerHr_EXP: t => t * 3, // base xp per hr
			BlesssBonus: t => t * 2, // god blessing bonus
			Bonus_MAJOR: t => t, // main bonus
			Bonus_Minor: t => t * 2, // passive bonus
			OfferingCost: t => 0, // free offerings
			OfferingOdds: t => 1, //offerings always work
		},
		collider: {
			AtomsUnlocked: t => t, // max 10
			AtomCost: t => 0, // atom collider upgrades are free,
			AtomBonuses: t => t, // atom bonus amount. Unclear how this works yet, assume t => t * 2 would be 2x regular bonus
			AtomBubbleUpgCost: t => 0, // atom bubble upgrades are free,
		},
		fixobj: false,
	},
	w6: {
		summoning: {
			OwlCost: t => t,
			
		},
	},
	fixobj: {},
};

exports.injectorConfig = {
	injreg:"\\w+\\.ApplicationMain\\s*?=",
	interceptPattern: "*N.js",
	showConsoleLog: false,
	chrome: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
};