define([
	'ash',
	'game/constants/PlayerActionConstants', 'game/constants/ItemConstants', 'game/constants/UpgradeConstants', 'game/constants/BagConstants', 'game/constants/WorldConstants',
	'game/vos/TradingPartnerVO', 'game/vos/IncomingCaravanVO', 'game/vos/ResourcesVO', 'game/vos/ResultVO'],
function (Ash, PlayerActionConstants, ItemConstants, UpgradeConstants, BagConstants, WorldConstants, TradingPartnerVO, IncomingCaravanVO, ResourcesVO, ResultVO) {
	
	var TradeConstants = {
		
		MIN_OUTGOING_CARAVAN_RES: 50,
		
		GOOD_TYPE_NAME_CURRENCY: "currency",
		GOOD_TYPE_NAME_INGREDIENTS: "ingredients",
		
		VALUE_INGREDIENTS: 0.1,
		VALUE_MARKUP_INCOMING_CARAVANS: 0.15,
		VALUE_MARKUP_OUTGOING_CARAVANS_INGREDIENTS: 0.5,
		VALUE_DISCOUNT_CAMP_ITEMS: 0.25,
		
		TRADING_PARTNERS: [
			new TradingPartnerVO(3, "Bone Crossing", [resourceNames.rope], [resourceNames.metal], false, false, [ "weapon" ], [ "weapon", "clothing_over", "clothing_upper", "clothing_lower", "clothing_hands", "clothing_head", "exploration" ]),
			new TradingPartnerVO(4, "Slugger Town", [resourceNames.metal], [resourceNames.food], false, true, [], ["exploration", "shoes" ]),
			new TradingPartnerVO(6, "Old Waterworks", [resourceNames.fuel], [], true, false, [], [ "clothing_over", "clothing_upper", "clothing_lower", "clothing_hands", "clothing_head" ]),
			new TradingPartnerVO(7, "Mill Road Academy", [resourceNames.food, resourceNames.water], [resourceNames.metal], true, false, [], [ "weapon", "artefact" ]),
			new TradingPartnerVO(9, "Bleaksey", [resourceNames.herbs], [resourceNames.medicine], false, true, [], [ "clothing_over", "clothing_upper", "clothing_lower", "clothing_hands", "clothing_head" ]),
			new TradingPartnerVO(10, "Pinewood", [resourceNames.medicine, resourceNames.rubber], [], true, false, [], [ "artefact", "exploration" ]),
			new TradingPartnerVO(12, "Highgate", [resourceNames.tools], [resourceNames.metal], true, false, [], [ "clothing_over", "clothing_upper", "clothing_lower", "clothing_hands", "clothing_head" ]),
			new TradingPartnerVO(14, "Factory 32", [resourceNames.concrete], [resourceNames.metal], true, false, [], [ "exploration" ]),
		],
		
		getTradePartner: function (campOrdinal) {
			for (var i = 0; i < this.TRADING_PARTNERS.length; i++) {
				if (this.TRADING_PARTNERS[i].campOrdinal === campOrdinal)
					return this.TRADING_PARTNERS[i];
			}
			return null;
		},
		
		getRandomTradePartner: function (campOrdinal) {
			var options = this.getValidTradePartners(campOrdinal);
			return options[Math.floor(Math.random() * options.length)];
		},
		
		getValidTradePartners: function (campOrdinal) {
			let result = [];
			for (var i = 0; i < this.TRADING_PARTNERS.length; i++) {
				let tradePartnerCampOrdinal = this.TRADING_PARTNERS[i].campOrdinal;
				if (campOrdinal <= WorldConstants.CAMP_ORDINAL_GROUND && tradePartnerCampOrdinal > WorldConstants.CAMP_ORDINAL_GROUND)
					return false;
				if (campOrdinal > WorldConstants.CAMP_ORDINAL_GROUND && tradePartnerCampOrdinal <= WorldConstants.CAMP_ORDINAL_GROUND)
					return false;
				if (tradePartnerCampOrdinal > campOrdinal + 1)
					return false;
				if (tradePartnerCampOrdinal < campOrdinal - 5)
					return false;
				
				result.push(this.TRADING_PARTNERS[i]);
			}
			return result;
		},
		
		makeResultVO: function (outgoingCaravan) {
			var result = new ResultVO("send_camp");
			var amountTraded = TradeConstants.getAmountTraded(outgoingCaravan.buyGood, outgoingCaravan.sellGood, outgoingCaravan.sellAmount);
			if (amountTraded > outgoingCaravan.capacity) {
				amountTraded = outgoingCaravan.capacity;
			}
			if (isResource(outgoingCaravan.buyGood)) {
				result.gainedResources.setResource(outgoingCaravan.buyGood, amountTraded);
			} else if (outgoingCaravan.buyGood === TradeConstants.GOOD_TYPE_NAME_CURRENCY) {
				result.gainedCurrency = amountTraded;
			} else if (outgoingCaravan.buyGood === TradeConstants.GOOD_TYPE_NAME_INGREDIENTS) {
				var numIngredients = Math.min(amountTraded, Math.floor(Math.random() * 3) + 1);
				var amountLeft = amountTraded;
				for (var i = 0; i < numIngredients; i++) {
					var ingredient = ItemConstants.getIngredient();
					var max = amountLeft;
					var min = Math.min(amountLeft, 1);
					var amount = Math.floor(Math.random() * max) + min;
					for (var j = 0; j < amount; j++) {
						result.gainedItems.push(ingredient.clone());
					}
					amountLeft -= amount;
				}
			} else {
				log.w("Unknown buy good: " + outgoingCaravan.buyGood);
			}
			result.selectedItems = result.gainedItems;
			result.selectedResources = result.gainedResources;
			return result;
		},
		
		getAmountTraded: function (buyGood, sellGood, sellAmount) {
			var amountGet = 0;
			var valueSell = TradeConstants.getResourceValue(sellGood) * sellAmount;
			if (isResource(buyGood)) {
				amountGet = valueSell / TradeConstants.getResourceValue(buyGood);
			} else if (buyGood === TradeConstants.GOOD_TYPE_NAME_CURRENCY) {
				amountGet = valueSell;
			} else if (buyGood === TradeConstants.GOOD_TYPE_NAME_INGREDIENTS) {
				amountGet = valueSell / TradeConstants.VALUE_INGREDIENTS * (1 - TradeConstants.VALUE_MARKUP_OUTGOING_CARAVANS_INGREDIENTS);
			} else {
				log.w("Unknown buy good: " + buyGood);
			}
			amountGet = Math.floor(amountGet+0.001);
			return amountGet;
		},
		
		getRequiredCapacity: function (good, amount) {
			if (isResource(good)) {
				return BagConstants.getResourceCapacity(good) * amount;
			} else if (good === TradeConstants.GOOD_TYPE_NAME_CURRENCY) {
				return BagConstants.CAPACITY_CURRENCY * amount;
			} else if (good === TradeConstants.GOOD_TYPE_NAME_INGREDIENTS) {
				return BagConstants.CAPACITY_ITEM_INGREDIENT * amount;
			} else {
				log.w("Unknown good: " + good);
				return 0;
			}
		},
		
		getResourceValue: function (name, isTrader) {
			var value = 0;
			switch (name) {
				case resourceNames.water: value = 0.01; break;
				case resourceNames.food: value = 0.01; break;
				case resourceNames.metal: value = 0.01; break;
				
				case resourceNames.rope: value = 0.015; break;
				case resourceNames.fuel: value = 0.02; break;

				case resourceNames.medicine: value = 0.05; break;
				case resourceNames.tools: value = 0.05; break;
				case resourceNames.concrete: value = 0.05; break;
				
				case resourceNames.rubber: value = 0.05; break;
				case resourceNames.herbs: value = 0.05; break;
			}
			if (isTrader)
				value = value + value * TradeConstants.VALUE_MARKUP_INCOMING_CARAVANS;
			return value;
		},
		
		getItemValue: function (item, isTrader, isUsed) {
			var value = 0;
			switch (item.type) {
				case ItemConstants.itemTypes.light:
					var lightBonus = item.getTotalBonus(ItemConstants.itemBonusTypes.light);
					if (lightBonus <= 25)
						value = 0.1;
					else
						value = (lightBonus - 10) / 30;
					break;
				case ItemConstants.itemTypes.weapon:
					var attackBonus = item.getTotalBonus(ItemConstants.itemBonusTypes.fight_att);
					if (attackBonus <= 3)
						value = 0.1;
					else
						value = attackBonus / 5;
					break;
				case ItemConstants.itemTypes.clothing_over:
				case ItemConstants.itemTypes.clothing_upper:
				case ItemConstants.itemTypes.clothing_lower:
				case ItemConstants.itemTypes.clothing_hands:
				case ItemConstants.itemTypes.clothing_head:
					value = Math.max(0.1, (item.getTotalBonus() / 12));
					break;
				case ItemConstants.itemTypes.shoes:
					var shoeBonus = 1 - item.getBonus(ItemConstants.itemBonusTypes.movement);
					var otherBonus = item.getTotalBonus() - shoeBonus;
					value = Math.pow(((shoeBonus)*5), 2) + otherBonus / 10;
					break;
				case ItemConstants.itemTypes.bag:
					value = Math.pow(((item.getTotalBonus() - 25) / 15), 1.75);
					break;
				case ItemConstants.itemTypes.follower:
					value = 0;
					break;
				case ItemConstants.itemTypes.ingredient:
					value = TradeConstants.VALUE_INGREDIENTS;
					break;
				case ItemConstants.itemTypes.exploration:
					value = 1;
					if (item.craftable) {
						value = this.getItemValueByCraftingIngredients(item);
					}
					break;
				case ItemConstants.itemTypes.uniqueEquipment:
					value = 1;
					break;
				case ItemConstants.itemTypes.artefact:
					value = 1;
					break;
				case ItemConstants.itemTypes.note:
					value = 0;
					break;
			}
			
			if (isTrader)
				value = value + value * TradeConstants.VALUE_MARKUP_INCOMING_CARAVANS;
			else if (isUsed)
				value = value - value * TradeConstants.VALUE_DISCOUNT_CAMP_ITEMS;
			
			value = Math.round(value * 100) / 100;
				
			return value;
		},
		
		getItemValueByCraftingIngredients: function (item) {
			var craftAction = "craft_" + item.id;
			var costs = PlayerActionConstants.costs[craftAction];
			let result = costs ? 0.1 * Object.keys(costs).length : 0;
			let ingredients = ItemConstants.getIngredientsToCraft(item.id);
			for (var i = 0; i < ingredients.length; i++) {
				let def = ingredients[i];
				let ingredient = ItemConstants.getItemByID(def.id);
				result += def.amount * this.getItemValue(ingredient);
			}
			return result;
		},
		
		getBlueprintValue: function (upgradeID) {
			return UpgradeConstants.getBlueprintCampOrdinal(upgradeID) + 2;
		},
		
		getCaravanCapacity: function (stableLevel) {
			return 500 * stableLevel;
		}
	
	};
	
	return TradeConstants;
	
});
