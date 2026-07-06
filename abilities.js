"use strict"

var ability_dict = {
	clear: {
		name: "Clear Weather",
		description: "Xóa bỏ mọi hiệu ứng Thời Tiết: Băng Giá, Sương Mù và Mưa Lớn. "
	},
	frost: {
		name: "Biting Frost",
		description: "Tất cả quân bài Cận Chiến của cả hai bên chỉ còn 1 sức mạnh. "
	},
	fog: {
		name: "Impenetrable Fog",
		description: "Tất cả quân bài Tầm Xa của cả hai bên chỉ còn 1 sức mạnh. "
	},
	rain: {
		name: "Torrential Rain",
		description: "Tất cả quân bài Công Thành của cả hai bên chỉ còn 1 sức mạnh. "
	},
	storm: {
		name: "Skellige Storm",
		description: "Giảm sức mạnh của tất cả quân bài Tầm Xa và Công Thành xuống còn 1. "
	},
	hero: {
		name: "Hero",
		description: "Không bị ảnh hưởng bởi bất kỳ Thẻ Đặc Biệt hay kỹ năng nào. "
	},
	decoy: {
		name: "Decoy",
		description: "Hoán đổi với một quân bài trên bàn để đưa nó trở lại tay bạn. "
	},
	horn: {
		name: "Commander's Horn",
		description: "Nhân đôi sức mạnh của tất cả quân bài trên hàng đó. Mỗi hàng chỉ dùng được 1 lần. ",
		placed: async card => await card.animate("horn")
	},
	mardroeme: {
		name: "Mardroeme",
		description: "Kích hoạt biến hình cho tất cả quân bài Berserker trên cùng hàng. ",
		placed: async (card, row) => {
			if (card.isLocked())
				return;
			let berserkers = row.findCards(c => c.abilities.includes("berserker"));
			await Promise.all(berserkers.map(async c => await ability_dict["berserker"].placed(c, row)));
		}
	},
	berserker: {
		name: "Berserker",
		description: "Biến thành gấu khi có thẻ Mardroeme trên cùng hàng. ",
		placed: async (card, row) => {
			if (row.effects.mardroeme === 0 || card.isLocked())
				return;
			row.removeCard(card);
			await row.addCard(new Card(card.target, card_dict[card.target], card.holder));
		}
	},
	scorch: {
		name: "Scorch",
		description: "Bị loại sau khi dùng. Tiêu diệt mọi quân bài mạnh nhất trên bàn. ",
		activated: async card => {	
			await ability_dict["scorch"].placed(card);
			await board.toGrave(card, card.holder.hand);
		},
		placed: async (card, row) => {
			if (card.isLocked() || game.scorchCancelled)
				return;
			if (row !== undefined)
				row.cards.splice(row.cards.indexOf(card), 1);
			let maxUnits = board.row.map(r => [r, r.maxUnits()]).filter(p => p[1].length > 0).filter(p => !p[0].isShielded());
			if (row !== undefined)
				row.cards.push(card);
			let maxPower = maxUnits.reduce( (a,p) => Math.max(a, p[1][0].power), 0 );
			let scorched = maxUnits.filter(p => p[1][0].power === maxPower);
			let cards = scorched.reduce((a, p) => a.concat(p[1].map(u => [p[0], u])), []);

			await Promise.all(cards.map(async u => await u[1].animate("scorch", true, false)));
			await Promise.all(cards.map(async u => await board.toGrave(u[1], u[0])));
		}
	},
	scorch_c: {
		name: "Scorch - Close Combat",
		description: "Tiêu diệt quân Cận Chiến mạnh nhất của đối phương nếu tổng sức mạnh Cận Chiến của họ từ 10 trở lên. ",
		placed: async (card) => await board.getRow(card, "close", card.holder.opponent()).scorch()
	},
	scorch_r: {
		name: "Scorch - Ranged",
		description: "Tiêu diệt quân Tầm Xa mạnh nhất của đối phương nếu tổng sức mạnh Tầm Xa của họ từ 10 trở lên. ",
		placed: async (card) => await board.getRow(card, "ranged", card.holder.opponent()).scorch()
	},
	scorch_s: {
		name: "Scorch - Siege",
		description: "Tiêu diệt quân Công Thành mạnh nhất của đối phương nếu tổng sức mạnh Công Thành của họ từ 10 trở lên. ",
		placed: async (card) => await board.getRow(card, "siege", card.holder.opponent()).scorch()
	},
	agile: {
		name:"Agile", 
		description: "Có thể đặt ở hàng Cận Chiến hoặc Tầm Xa. Không thể di chuyển sau khi đã đặt. "
	},
	muster: {
		name:"Muster", 
		description: "Tự động triệu hồi tất cả các quân bài cùng tên còn lại trong bộ bài. ",
		placed: async (card) => {
			if (card.isLocked())
				return;
			let pred = c => c.target === card.target;
			let units = card.holder.hand.getCards(pred).map(x => [card.holder.hand, x])
			.concat(card.holder.deck.getCards(pred).map( x => [card.holder.deck, x] ) );
			if (units.length === 0)
				return;
			await card.animate("muster");
			if (card.row === "agile") {
				await Promise.all(units.map(async p => await board.addCardToRow(p[1], card.currentLocation, p[1].holder, p[0])));
			} else {
				await Promise.all(units.map(async p => await board.addCardToRow(p[1], p[1].row, p[1].holder, p[0])));
            }
		}
	},
	spy: {
		name: "Spy",
		description: "Đặt lên chiến trường của đối phương (tính vào tổng sức mạnh của họ) và rút 2 lá từ bộ bài của bạn. ",
		placed: async (card) => {
			if (card.isLocked())
				return;
			await card.animate("spy");
			for (let i=0;i<2;i++) {
				if (card.holder.deck.cards.length > 0)
					await card.holder.deck.draw(card.holder.hand);
			}
			card.holder = card.holder.opponent();
		}
	},
	medic: {
		name: "Medic",
		description: "Chọn một quân bài từ mộ bài và triệu hồi ngay lập tức (không áp dụng với Thẻ Anh Hùng hoặc Thẻ Đặc Biệt) ",
		placed: async (card) => {
			if (card.isLocked() || (card.holder.grave.findCards(c => c.isUnit()) <= 0))
				return;
			let grave = board.getRow(card, "grave", card.holder);
			let respawns = [];
			if (game.randomRespawn) {
				for (var i = 0; i < game.medicCount; i++) {
                    if (card.holder.grave.findCards(c => c.isUnit()).length > 0) {
						let res = grave.findCardsRandom(c => c.isUnit())[0];
						grave.removeCard(res);
						grave.addCard(res);
						await res.animate("medic");
						await res.autoplay(grave);
					}
				}
				return;
			} else if (card.holder.controller instanceof ControllerAI) {
				for (var i = 0; i < game.medicCount; i++) {
					if (card.holder.grave.findCards(c => c.isUnit()).length > 0) {
						let res = card.holder.controller.medic(card, grave);
						grave.removeCard(res);
						grave.addCard(res);
						await res.animate("medic");
						await res.autoplay(grave);
					}
				}
				return;
			}

      //Player can't pick more cards than what's actually available in the graveyard
      let cardPicks = Math.min(game.medicCount, card.holder.grave.findCards(c => c.isUnit()).length);
      await ui.queueCarousel(card.holder.grave, cardPicks, (c, i) => respawns.push({ card: c.cards[i] }), c => c.isUnit(), true);
			await Promise.all(respawns.map(async wrapper => {
				let res = wrapper.card;
				grave.removeCard(res);
				grave.addCard(res);
				await res.animate("medic");
				await res.autoplay(grave);
			}));
		}
	},
	morale: {
		name: "Morale Boost",
		description: "Cộng +1 sức mạnh cho tất cả quân bài trên cùng hàng (trừ chính nó). ",
		placed: async card => await card.animate("morale")
	},
	bond: {
		name: "Tight Bond",
		description: "Đặt cạnh một quân bài cùng tên để nhân đôi sức mạnh của cả hai. ",
		placed: async card => {
			if (card.isLocked())
				return;
			let bonds = card.currentLocation.findCards(c => c.target === card.target).filter(c => c.abilities.includes("bond")).filter(c => !c.isLocked());
			if (bonds.length > 1)
				await Promise.all( bonds.map(c => c.animate("bond")) );
		}
	},
	avenger: {
		name: "Avenger",
		description: "Khi bị loại khỏi bàn, triệu hồi một quân bài mạnh hơn thay thế vào vị trí đó. ",
        removed: async (card) => {
			if (game.over || game.roundHistory.length > 2 || card.isLocked())
				return;
			// Some avengers are related to muster and should trigger it, if not already in deck
            if (card_dict[card.target]["ability"].includes("muster") && (card.holder.deck.findCards(c => c.key === card.target).length === 0 && card.holder.hand.findCards(c => c.key === card.target).length === 0)) {
                for (let i = 0; i < card_dict[card.target]["count"]; i++) {
                    let avenger = new Card(card.target, card_dict[card.target], card.holder);
                    avenger.removed.push(() => setTimeout(() => avenger.holder.grave.removeCard(avenger), 2000));
                    if (card.target != card.key)
                        await board.addCardToRow(avenger, avenger.row, card.holder);
                }
            } else if (card.target === card.key) {
                await board.moveTo(card, card.row, card.holder.grave);
			} else {
				let avenger;
				// If one copy at least in hand or deck, use it instead of creating a duplicate
				if (card.holder.deck.findCards(c => c.key === card.target).length) {
					avenger = card.holder.deck.findCard(c => c.key === card.target);
					await board.moveTo(avenger, avenger.row, card.holder.deck);
				} else if (card.holder.hand.findCards(c => c.key === card.target).length) {
					avenger = card.holder.hand.findCard(c => c.key === card.target);
					await board.moveTo(avenger, avenger.row, card.holder.hand);
				} else {
					avenger = new Card(card.target, card_dict[card.target], card.holder);
                    await board.addCardToRow(avenger, avenger.row, card.holder);
                    if (card.target != card.key)
					    avenger.removed.push(() => setTimeout(() => avenger.holder.grave.removeCard(avenger), 2000));
                }
            }
			
		},
        weight: (card) => {
            if (game.roundHistory.length > 2)
                return 1;
            return Number(card_dict[card.target]["strength"]);
        }
	},
	cintra_slaughter: {
		name: "Slaughter of Cintra",
		description: "Khi sử dụng thẻ đặc biệt Slaughter of Cintra, tiêu diệt tất cả quân bài phe bạn có kỹ năng Slaughter of Cintra, sau đó rút số lá tương đương với số quân đã bị tiêu diệt.",
		activated: async card => {
			let targets = board.row.map(r => [r, r.findCards(c => c.abilities.includes("cintra_slaughter")).filter(c => c.holder === card.holder).filter(c => !c.isLocked())]);
			let cards = targets.reduce((a, p) => a.concat(p[1].map(u => [p[0], u])), []);
			let nb_draw = cards.length;
			await Promise.all(cards.map(async u => await u[1].animate("scorch", true, false)));
			await Promise.all(cards.map(async u => await board.toGrave(u[1], u[0])));
			await board.toGrave(card, card.holder.hand);

			for (let i = 0; i < nb_draw; i++) {
				if (card.holder.deck.cards.length > 0)
					await card.holder.deck.draw(card.holder.hand);
			}
		},
		weight: (card) => 30
    },
	foltest_king: {
		description: "Chọn một thẻ Sương Mù Dày Đặc từ bộ bài và kích hoạt ngay lập tức. ",
		activated: async card => {
			let out = card.holder.deck.findCard(c => c.name === "Impenetrable Fog");
			if (out)
				await out.autoplay(card.holder.deck);
		},
		weight: (card, ai) => ai.weightWeatherFromDeck(card, "fog")
	},
	foltest_lord: {
		description: "Xóa bỏ mọi hiệu ứng Thời Tiết đang có trên bàn (gây ra bởi Băng Giá, Mưa Như Trút hoặc Sương Mù Dày Đặc). ",
		activated: async () => {
			tocar("clear", false);
			await weather.clearWeather()
		},
		weight: (card, ai) =>  ai.weightCard( card_dict["spe_clear"] )
	},
  henselt_vanquisher: {
		description: "Nhân đôi sức mạnh của tất cả quân Công Thành phe bạn (trừ khi hàng đó đã có Kèn Hiệu Chỉ Huy).",
		activated: async card => await board.getRow(card, "siege", card.holder).leaderHorn(card),
		weight: (card, ai) => ai.weightHornRow(card, board.getRow(card, "siege", card.holder))
	},
	foltest_steelforged: {
		description: "Tiêu diệt quân Công Thành mạnh nhất của đối phương nếu tổng sức mạnh Công Thành của họ từ 10 trở lên. ",
		activated: async card => await ability_dict["scorch_s"].placed(card),
		weight: (card, ai, max) => ai.weightScorchRow(card, max, "siege")
	},
	demavend_son: {
		description: "Tiêu diệt quân Tầm Xa mạnh nhất của đối phương nếu tổng sức mạnh Tầm Xa của họ từ 10 trở lên. ",
		activated: async card => await ability_dict["scorch_r"].placed(card),
		weight: (card, ai, max) => ai.weightScorchRow(card, max, "ranged")
	},
	emhyr_imperial: {
		description: "Chọn một thẻ Mưa Như Trút từ bộ bài và kích hoạt ngay lập tức. ",
		activated: async card => {
			let out = card.holder.deck.findCard(c => c.name === "Torrential Rain");
			if (out)
				await out.autoplay(card.holder.deck);
		},
		weight: (card, ai) => ai.weightWeatherFromDeck(card, "rain")
	},
	emhyr_emperor: {
		description: "Xem 3 lá bài ngẫu nhiên từ tay của đối phương. ",
		activated: async card => {
			if (card.holder.controller instanceof ControllerAI)
				return;
			let container = new CardContainer();
			container.cards = card.holder.opponent().hand.findCardsRandom(() => true, 3);
			try {
				Carousel.curr.cancel();
			} catch (err) { }
			await ui.viewCardsInContainer(container);
		},
		weight: card => {
			let count = card.holder.opponent().hand.cards.length;
			return count === 0 ? 0 : Math.max(10, 10 * (8 - count));
		}
	},
	emhyr_whiteflame: {
		description: "Vô hiệu hóa kỹ năng Chỉ Huy của đối phương. "
	},
	emhyr_relentless: {
		description: "Rút một lá bài từ mộ bài của đối phương. ",
		activated: async card => {
			let grave = board.getRow(card, "grave", card.holder.opponent());
			if (grave.findCards(c => c.isUnit()).length === 0)
				return;

			if (card.holder.controller instanceof ControllerAI) {
				let newCard = card.holder.controller.medic(card, grave);
				newCard.holder = card.holder;
				await board.toHand(newCard, grave);
				return;
			}
			try {
				Carousel.curr.cancel();
			} catch (err) { }
			await ui.queueCarousel(grave, 1, (c,i) => {
				let newCard = c.cards[i];
				newCard.holder = card.holder;
				board.toHand(newCard, grave);
			}, c => c.isUnit(), true);
		},
		weight: (card, ai, max, data) => ai.weightMedic(data, 0, card.holder.opponent())
	},
	emhyr_invader: {
		description: "Các kỹ năng triệu hồi quân bài trở lại bàn sẽ triệu hồi ngẫu nhiên một quân. Áp dụng cho cả hai người chơi.",
		gameStart: () => game.randomRespawn = true
	},
	eredin_commander: {
		description: "Nhân đôi sức mạnh của tất cả quân Cận Chiến phe bạn (trừ khi hàng đó đã có Kèn Hiệu Chỉ Huy).",
		activated: async card => await board.getRow(card, "close", card.holder).leaderHorn(card),
		weight: (card, ai) => ai.weightHornRow(card, board.getRow(card, "close", card.holder))
	},
	eredin_bringer_of_death: {
		name: "Eredin : Bringer of Death",
		description: "Hoàn trả một lá bài từ mộ bài về tay bạn.",
		activated: async card => {
			let newCard;
			if (card.holder.controller instanceof ControllerAI) {
				newCard = card.holder.controller.medic(card, card.holder.grave);
			} else {
				try {
					Carousel.curr.exit();
				} catch (err) { }
				await ui.queueCarousel(card.holder.grave, 1, (c,i) => newCard = c.cards[i], c => c.isUnit(), false, false);
			}
			if (newCard)
				await board.toHand(newCard, card.holder.grave);
		},
		weight: (card, ai, max, data) => ai.weightMedic(data, 0, card.holder)
	},
	eredin_destroyer: {
		description: "Bỏ 2 lá bài rồi rút 1 lá tùy chọn từ bộ bài của bạn.",
		activated: async (card) => {
			let hand = board.getRow(card, "hand", card.holder);
			let deck = board.getRow(card, "deck", card.holder);
			if (card.holder.controller instanceof ControllerAI) {
				let cards = card.holder.controller.discardOrder(card).splice(0, 2).filter(c => c.basePower < 7);
				await Promise.all(cards.map(async c => await board.toGrave(c, card.holder.hand)));
				card.holder.deck.draw(card.holder.hand);
				return;
			} else {
				try {
					Carousel.curr.exit();
				} catch (err) { }
            }
			await ui.queueCarousel(hand, 2, (c,i) => board.toGrave(c.cards[i], c), () => true);
			await ui.queueCarousel(deck, 1, (c,i) => board.toHand(c.cards[i], deck), () => true, true);
		},
		weight: (card, ai) => {
			let cards = ai.discardOrder(card).splice(0,2).filter(c => c.basePower < 7);
			if (cards.length < 2)
				return 0;
			return cards[0].abilities.includes("muster") ? 50 : 25;
		}
	},
	eredin_king: {
		description: "Chọn bất kỳ thẻ Thời Tiết nào từ bộ bài và kích hoạt ngay lập tức.",
		activated: async card => {
			let deck = board.getRow(card, "deck", card.holder);
			if (card.holder.controller instanceof ControllerAI) {
				await ability_dict["eredin_king"].helper(card).card.autoplay(card.holder.deck);
			} else {
				try {
					Carousel.curr.cancel();
				} catch (err) { }
				await ui.queueCarousel(deck, 1, (c,i) => board.toWeather(c.cards[i], deck), c => c.faction === "weather", true);
			}
		},
		weight: (card, ai, max) => ability_dict["eredin_king"].helper(card).weight,
		helper: card => {
			let weather = card.holder.deck.cards.filter(c => c.row === "weather").reduce((a,c) =>a.map(c => c.name).includes(c.name) ? a : a.concat([c]), [] );
			
			let out, weight = -1;
			weather.forEach( c => {
				let w = card.holder.controller.weightWeatherFromDeck(c, c.abilities[0]);
				if (w > weight) {
					weight = w;
					out = c;
				}
			});
			return {card: out, weight: weight};
		}			
	},
	eredin_treacherous: {
		description: "Nhân đôi sức mạnh của tất cả quân Bài Gián Điệp (áp dụng cho cả hai người chơi).",
		gameStart: () => game.spyPowerMult = 2
	},
	francesca_queen: {
		description: "Tiêu diệt quân Cận Chiến mạnh nhất của đối phương nếu tổng sức mạnh Cận Chiến của họ từ 10 trở lên.",
		activated: async card => await ability_dict["scorch_c"].placed(card),
		weight: (card, ai, max) => ai.weightScorchRow(card, max, "close")
	},
	francesca_beautiful: {
		description: "Nhân đôi sức mạnh của tất cả quân Tầm Xa phe bạn (trừ khi hàng đó đã có Kèn Hiệu Chỉ Huy).",
		activated: async card => await board.getRow(card, "ranged", card.holder).leaderHorn(card),
		weight: (card, ai) => ai.weightHornRow(card, board.getRow(card, "ranged", card.holder))
	},
	francesca_daisy: {
		description: "Rút thêm một lá bài ở đầu trận đấu.",
		placed: card => game.gameStart.push( () => {
			let draw = card.holder.deck.removeCard(0);
			card.holder.hand.addCard( draw );
			return true;
		})
	},
	francesca_pureblood: {
		description: "Chọn một thẻ Băng Giá từ bộ bài và kích hoạt ngay lập tức.",
		activated: async card => {
			let out = card.holder.deck.findCard(c => c.name === "Biting Frost");
			if (out)
				await out.autoplay(card.holder.deck);
		},
		weight: (card, ai) => ai.weightWeatherFromDeck(card, "frost")
	},
	francesca_hope: {
		description: "Di chuyển các quân bài Linh Hoạt đến hàng hợp lệ có thể tối đa hóa sức mạnh của chúng (không di chuyển nếu đã ở hàng tối ưu).",
		activated: async card => {
			let close = board.getRow(card, "close");
			let ranged =  board.getRow(card, "ranged");
			let cards = ability_dict["francesca_hope"].helper(card);
			await Promise.all(cards.map(async p => await board.moveTo(p.card, p.row === close ? ranged : close, p.row) ) );
			
		},
		weight: card => {
			let cards = ability_dict["francesca_hope"].helper(card);
			return cards.reduce((a,c) => a + c.weight, 0);
		},
		helper: card => {
			let close = board.getRow(card, "close");
			let ranged =  board.getRow(card, "ranged");
			return validCards(close).concat( validCards(ranged) );
			function validCards(cont) {
				return cont.findCards(c => c.row === "agile").filter(c => dif(c,cont) > 0).map(c => ({card:c, row:cont, weight:dif(c,cont)}))
			}
			function dif(card, source) {
				return (source === close ? ranged : close).calcCardScore(card) - card.power;
			}
		}
	},
	crach_an_craite: {
		description: "Xáo trộn tất cả bài trong mộ bài của mỗi người chơi trở lại vào bộ bài của họ.",
		activated: async card => {
			Promise.all(card.holder.grave.cards.map(c => board.toDeck(c, card.holder.grave)));
			await Promise.all(card.holder.opponent().grave.cards.map(c => board.toDeck(c, card.holder.opponent().grave)));
		},
		weight: (card, ai, max, data) => {
			if( game.roundCount < 2)
				return 0;
			let medics = card.holder.hand.findCard(c => c.abilities.includes("medic"));
			if (medics !== undefined)
				return 0;
			let spies = card.holder.hand.findCard(c => c.abilities.includes("spy"));
			if (spies !== undefined)
				return 0;
			if (card.holder.hand.findCard(c => c.abilities.includes("decoy")) !== undefined && (data.medic.length || data.spy.length && card.holder.deck.findCard(c => c.abilities.includes("medic")) !== undefined) )
				return 0;
			return 15;
		}
	},
	king_bran: {
		description: "Quân bài chỉ mất một nửa sức mạnh khi chịu ảnh hưởng của Thời Tiết xấu",
		placed: card => {
			for (var i = 0; i < board.row.length; i++) {
				if (card.holder === player_me && i > 2)
					board.row[i].halfWeather = true;
				else if (card.holder === player_op && i < 3)
					board.row[i].halfWeather = true;
            }
        }
	},
	queen_calanthe: {
		description: "Ra một quân bài rồi rút một lá từ bộ bài của bạn.",
		activated: async card => {
			let units = card.holder.hand.cards.filter(c => c.isUnit());
			if (units.length === 0)
				return;
            let wrapper = { card: null };
            if (card.holder.controller instanceof ControllerAI) {
                wrapper.card = units[randomInt(units.length)];
            } else {
                await ui.queueCarousel(board.getRow(card, "hand", card.holder), 1, (c, i) => wrapper.card = c.cards[i], c => c.isUnit(), true);
            }
			wrapper.card.autoplay();
			card.holder.hand.removeCard(wrapper.card);
			if (card.holder.deck.cards.length > 0)
				await card.holder.deck.draw(card.holder.hand);
		},
		weight: (card, ai) => {
			let units = card.holder.hand.cards.filter(c => c.isUnit());
			if (units.length === 0)
				return 0;
			return 15;
        }
	},
	fake_ciri: {
		description: "Bỏ một lá bài từ tay rồi rút hai lá từ bộ bài của bạn.",
		activated: async card => {
			if (card.holder.hand.cards.length === 0)
				return;
			let hand = board.getRow(card, "hand", card.holder);
			if (card.holder.controller instanceof ControllerAI) {
				let cards = card.holder.controller.discardOrder(card).splice(0, 1).filter(c => c.basePower < 7);
				await Promise.all(cards.map(async c => await board.toGrave(c, card.holder.hand)));
			} else {
				try {
					Carousel.curr.exit();
				} catch (err) { }
				await ui.queueCarousel(hand, 1, (c, i) => board.toGrave(c.cards[i], c), () => true);
			}
			
			for (let i = 0; i < 2; i++) {
				if (card.holder.deck.cards.length > 0)
					await card.holder.deck.draw(card.holder.hand);
			}
		},
		weight: (card, ai) => {
			if (card.holder.hand.cards.length === 0)
				return 0;
			return 15;
		}
	},
	radovid_stern: {
		description: "Bỏ 2 lá bài rồi rút 1 lá tùy chọn từ bộ bài của bạn.",
		activated: async (card) => {
			let hand = board.getRow(card, "hand", card.holder);
			let deck = board.getRow(card, "deck", card.holder);
			if (card.holder.controller instanceof ControllerAI) {
				let cards = card.holder.controller.discardOrder(card).splice(0, 2).filter(c => c.basePower < 7);
				await Promise.all(cards.map(async c => await board.toGrave(c, card.holder.hand)));
				card.holder.deck.draw(card.holder.hand);
				return;
			} else {
				try {
					Carousel.curr.exit();
				} catch (err) { }
			}
			await ui.queueCarousel(hand, 2, (c, i) => board.toGrave(c.cards[i], c), () => true);
			await ui.queueCarousel(deck, 1, (c, i) => board.toHand(c.cards[i], deck), () => true, true);
		},
		weight: (card, ai) => {
			let cards = ai.discardOrder(card).splice(0, 2).filter(c => c.basePower < 7);
			if (cards.length < 2)
				return 0;
			return cards[0].abilities.includes("muster") ? 50 : 25;
		}
	},
	radovid_ruthless: {
		description: "Vô hiệu hóa kỹ năng Thiêu Đốt trong một lượt",
		activated: async card => {
			game.scorchCancelled = true;
			await ui.notification("north-scorch-cancelled", 1200);
			game.roundStart.push(async () => {
				game.scorchCancelled = false;
				return true;
			});
		}
	},
	vilgefortz_magician_kovir: {
		description: "Giảm một nửa sức mạnh của tất cả quân Bài Gián Điệp (áp dụng cho cả hai người chơi).",
		gameStart: () => game.spyPowerMult = 0.5
	},
	cosimo_malaspina: {
		description: "Tiêu diệt quân Cận Chiến mạnh nhất của đối phương nếu tổng sức mạnh Cận Chiến của họ từ 10 trở lên.",
		activated: async card => await ability_dict["scorch_c"].placed(card),
		weight: (card, ai, max) => ai.weightScorchRow(card, max, "close")
	},
	resilience: {
		name: "Resilience",
		description: "Giữ lại trên bàn cho lượt sau nếu có một quân bài khác phe bạn trên bàn có chung một kỹ năng.",
		placed: async card => {
			game.roundEnd.push(async () => {
				if (card.isLocked())
					return;
				let units = card.holder.getAllRowCards().filter(c => c.abilities.includes(card.abilities.at(-1)));
				if (units.length < 2)
					return;
				card.noRemove = true;
				await card.animate("resilience");
				game.roundStart.push(async () => {
					delete card.noRemove;
					let school = card.abilities.at(-1);
					if (!card.holder.effects["witchers"][school])
						card.holder.effects["witchers"][school] = 0
					card.holder.effects["witchers"][school]++;
					return true;
				});
			});
		}
	},
	witcher_wolf_school: {
		name: "Wolf School of Witchers",
		description: "Mỗi quân bài thuộc trường phái witcher này được cộng 2 sức mạnh cho mỗi lá bài cùng trường phái trong bộ bài.",
		placed: async card => {
			let school = card.abilities.at(-1);
			if (!card.holder.effects["witchers"][school])
				card.holder.effects["witchers"][school] = 0
			card.holder.effects["witchers"][school]++;
		},
		removed: async card => {
			let school = card.abilities.at(-1);
			card.holder.effects["witchers"][school]--;
		}
	},
	witcher_viper_school: {
		name: "Viper School of Witchers",
        description: "Mỗi quân bài thuộc trường phái Witcher này được cộng 2 sức mạnh cho mỗi lá bài cùng trường phái có mặt trên bàn.",
		placed: async card => {
			let school = card.abilities.at(-1);
			if (!card.holder.effects["witchers"][school])
				card.holder.effects["witchers"][school] = 0
			card.holder.effects["witchers"][school]++;
		},
		removed: async card => {
			let school = card.abilities.at(-1);
			card.holder.effects["witchers"][school]--;
		}
	},
	witcher_bear_school: {
		name: "Bear School of Witchers",
        description: "Mỗi quân bài thuộc trường phái Witcher này được cộng 2 sức mạnh cho mỗi lá bài cùng trường phái trong bộ bài của bạn.",
		placed: async card => {
			let school = card.abilities.at(-1);
			if (!card.holder.effects["witchers"][school])
				card.holder.effects["witchers"][school] = 0
			card.holder.effects["witchers"][school]++;
		},
		removed: async card => {
			let school = card.abilities.at(-1);
			card.holder.effects["witchers"][school]--;
		}
	},
	witcher_cat_school: {
		name: "Cat School of Witchers",
        description: "Mỗi quân bài thuộc trường phái Witcher này được cộng 2 sức mạnh cho mỗi lá bài cùng trường phái trong bộ bài của bạn.",
		placed: async card => {
			let school = card.abilities.at(-1);
			if (!card.holder.effects["witchers"][school])
				card.holder.effects["witchers"][school] = 0
			card.holder.effects["witchers"][school]++;
		},
		removed: async card => {
			let school = card.abilities.at(-1);
			card.holder.effects["witchers"][school]--;
		}
	},
	witcher_griffin_school: {
		name: "Griffin School of Witchers",
        description: "Mỗi quân bài thuộc trường phái Witcher này được cộng 2 sức mạnh cho mỗi lá bài cùng trường phái trong bộ bài của bạn.",
		placed: async card => {
			let school = card.abilities.at(-1);
			if (!card.holder.effects["witchers"][school])
				card.holder.effects["witchers"][school] = 0
			card.holder.effects["witchers"][school]++;
		},
		removed: async card => {
			let school = card.abilities.at(-1);
			card.holder.effects["witchers"][school]--;
		}
	},
	shield: {
		name: "Shield",
		description: "Bảo vệ các quân bài trong hàng khỏi mọi kỹ năng, trừ hiệu ứng Thời Tiết.",
		weight: (card) => 30
	},
	seize: {
		name: "Seize",
		description: "Di chuyển các quân Cận Chiến có sức mạnh thấp nhất phe bạn khỏi bàn / Kỹ năng của chúng sẽ không còn hiệu lực.",
		activated: async card => {
			let opCloseRow = board.getRow(card, "close", card.holder.opponent());
			let meCloseRow = board.getRow(card, "close", card.holder);
			if (opCloseRow.isShielded())
				return;
			let units = opCloseRow.minUnits();
			if (units.length === 0)
				return;
			await Promise.all(units.map(async c => await c.animate("seize")));
			units.forEach(async c => {
				c.holder = card.holder;
				await board.moveToNoEffects(c, meCloseRow, opCloseRow);
			});
			await board.toGrave(card, card.holder.hand);
		},
		weight: (card) => {
			if (card.holder.opponent().getAllRows()[0].isShielded())
				return 0;
			return card.holder.opponent().getAllRows()[0].minUnits().reduce((a, c) => a + c.power, 0) * 2
		}
	},
	lock: {
		name: "Lock",
		description: "Khoá hoặc vô hiệu hóa kỹ năng của quân bài tiếp theo được ra ở hàng đó (bỏ qua quân không có kỹ năng và quân Anh Hùng).",
		weight: (card) => 20
	},
	knockback: {
		name: "Knockback",
		description: "Đẩy tất cả quân bài ở hàng được chọn (Cận Chiến hoặc Tầm Xa) lùi về phía hàng Công Thành, bỏ qua khiên bảo vệ.",
		activated: async (card, row) => {
			let units = row.findCards(c => c.isUnit());
            if (units.length > 0) {
                let targetRow;
                for (var i = 0; i < board.row.length; i++) {
                    if (board.row[i] === row) {
                        if (i < 3)
                            targetRow = board.row[Math.max(0, i - 1)];
                        else
                            targetRow = board.row[Math.min(5, i + 1)];
                    }
                }
                await Promise.all(units.map(async c => await c.animate("knockback")));
                units.map(async c => {
                    if (c.abilities.includes("bond") || c.abilities.includes("morale") || c.abilities.includes("horn"))   // Exception for bond cards, these abilities should continue to work after
                        await board.moveTo(c, targetRow, row);
                    else
                        await board.moveToNoEffects(c, targetRow, row);
                });

                
            }
			await board.toGrave(card, card.holder.hand);
		},
        weight: (card) => {
            if (board.getRow(card, "close", card.holder.opponent()).cards.length + board.getRow(card, "ranged", card.holder.opponent()).cards.length === 0)
				return 0;
			let score = 0;
            if (board.getRow(card, "close", card.holder.opponent()).cards.length > 0 && (board.getRow(card, "close", card.holder.opponent()).effects.horn > 0 || board.getRow(card, "ranged", card.holder.opponent()).effects.weather || Object.keys(board.getRow(card, "close", card.holder.opponent()).effects.bond).length > 1 || board.getRow(card, "close", card.holder.opponent()).isShielded()))
                score = Math.floor(board.getRow(card, "close", card.holder.opponent()).cards.filter(c => c.isUnit()).reduce((a, c) => a + c.power, 0) * 0.5);
            if (board.getRow(card, "ranged", card.holder.opponent()).cards.length > 0 && (board.getRow(card, "ranged", card.holder.opponent()).effects.horn > 0 || board.getRow(card, "siege", card.holder.opponent()).effects.weather || Object.keys(board.getRow(card, "ranged", card.holder.opponent()).effects.bond).length > 1 || board.getRow(card, "ranged", card.holder.opponent()).isShielded()))
                score = Math.floor(board.getRow(card, "close", card.holder.opponent()).cards.filter(c => c.isUnit()).reduce((a, c) => a + c.power, 0) * 0.5);
			return Math.max(1, score);
        }
	},
	alzur_maker: {
		description: "Tiêu diệt một quân bài của bạn trên bàn và triệu hồi một Koshchey.",
		activated: (card, player) => {
			player.endTurnAfterAbilityUse = false;
			ui.showPreviewVisuals(card);
            ui.enablePlayer(true);
			if(!(player.controller instanceof ControllerAI))
				ui.setSelectable(card, true);
		},
		target: "wu_koshchey",
		weight: (card, ai, max) => {
			if (ai.player.getAllRowCards().filter(c => c.isUnit()).length === 0)
				return 0;
			return ai.weightScorchRow(card, max, "close");
		}
	},
	vilgefortz_sorcerer: {
		description: "Xóa bỏ tất cả hiệu ứng Thời Tiết đang có trên bàn.",
		activated: async () => {
			tocar("clear", false);
			await weather.clearWeather()
		},
		weight: (card, ai) => ai.weightCard(card_dict["spe_clear"])
	},
	anna_henrietta_duchess: {
		description: "Phá hủy một Kèn Hiệu Chỉ Huy trong bất kỳ hàng nào của đối phương mà bạn chọn.",
		activated: (card, player) => {
			player.endTurnAfterAbilityUse = false;
			ui.showPreviewVisuals(card);
			ui.enablePlayer(true);
			if (!(player.controller instanceof ControllerAI))
				ui.setSelectable(card, true);
		},
		weight: (card, ai) => {
			let horns = card.holder.opponent().getAllRows().filter(r => r.special.findCards(c => c.abilities.includes("horn")).length > 0).sort((a, b) => b.total - a.total);
			if (horns.length === 0)
				return 0;
			return horns[0].total;
        }
	},
	toussaint_wine: {
		name: "Toussaint Wine",
		description: "Đặt vào hàng Cận Chiến hoặc Tầm Xa, tăng 2 sức mạnh cho tất cả quân bài trên hàng đã chọn. Mỗi hàng chỉ được đặt một lần.",
		placed: async card => await card.animate("morale")
	},
	anna_henrietta_ladyship: {
		description: "Triệu hồi một quân bài từ mộ bài của bạn và ra nó ngay lập tức.",
		activated: async card => {
			let newCard;
			if (card.holder.controller instanceof ControllerAI) {
				newCard = card.holder.controller.medic(card, card.holder.grave);
			} else {
				try {
					Carousel.curr.exit();
				} catch (err) { }
				await ui.queueCarousel(card.holder.grave, 1, (c, i) => newCard = c.cards[i], c => c.isUnit(), false, false);
			}
			if (newCard)
				await newCard.autoplay(card.holder.grave);
		},
		weight: (card, ai, max, data) => ai.weightMedic(data, 0, card.holder)
	},
	anna_henrietta_grace: {
		description: "Vô hiệu hóa kỹ năng Decoy trong một lượt.",
		activated: async card => {
			game.decoyCancelled = true;
			await ui.notification("toussaint-decoy-cancelled", 1200);
			game.roundStart.push(async () => {
				game.decoyCancelled = false;
				return true;
			});
		},
		weight: (card) => game.decoyCancelled ? 0 : 10
	},
	meve_princess: {
		description: "Nếu đối phương có tổng sức mạnh từ 10 trở lên trên một hàng, tiêu diệt quân bài mạnh nhất trên hàng đó (chỉ ảnh hưởng đến phía đối phương trên chiến trường).",
		activated: async (card, player) => {
			player.endTurnAfterAbilityUse = false;
			ui.showPreviewVisuals(card);
			ui.enablePlayer(true);
			if (!(player.controller instanceof ControllerAI))
				ui.setSelectable(card, true);
		},
		weight: (card, ai, max) => {
			return Math.max(ai.weightScorchRow(card, max, "close"), ai.weightScorchRow(card, max, "ranged"), ai.weightScorchRow(card, max, "siege"));
		}
	},
	shield_c: {
		name: "Melee Shield",
		description: "Bảo vệ các quân bài ở hàng Cận Chiến khỏi mọi kỹ năng, trừ hiệu ứng Thời Tiết.",
		weight: (card) => 20
	},
	shield_r: {
		name: "Ranged Shield",
		description: "Bảo vệ các quân bài ở hàng Tầm Xa khỏi mọi kỹ năng, trừ hiệu ứng Thời Tiết.",
		weight: (card) => 20
	},
	shield_s: {
		name: "Siege Shield",
		description: "Bảo vệ các quân bài ở hàng Công Thành khỏi mọi kỹ năng, trừ hiệu ứng Thời Tiết.",
		weight: (card) => 20
	},
	meve_white_queen: {
		description: "Tất cả quân bài Hồi Máu có thể chọn hai quân bài từ mộ bài để triệu hồi (áp dụng cho cả hai người chơi).",
		gameStart: () => game.medicCount = 2
	},
	carlo_varese: {
		description: "Nếu đối phương có tổng sức mạnh từ 10 trở lên trên một hàng, tiêu diệt quân bài mạnh nhất trên hàng đó (chỉ ảnh hưởng đến phía đối phương trên bàn đấu).",
		activated: async (card, player) => {
			player.endTurnAfterAbilityUse = false;
			ui.showPreviewVisuals(card);
			ui.enablePlayer(true);
			if (!(player.controller instanceof ControllerAI))
				ui.setSelectable(card, true);
		},
		weight: (card, ai, max) => {
			return Math.max(ai.weightScorchRow(card, max, "close"), ai.weightScorchRow(card, max, "ranged"), ai.weightScorchRow(card, max, "siege"));
		}
	},
	francis_bedlam: {
		description: "Gửi tất cả quân Bài Gián Điệp vào mộ bài của phe mà chúng đang đứng.",
		activated: async (card, player) => {
            let op_spies = card.holder.opponent().getAllRowCards().filter(c => c.isUnit() && c.abilities.includes("spy"));
            let me_spies = card.holder.getAllRowCards().filter(c => c.isUnit() && c.abilities.includes("spy"));
			await op_spies.map(async c => await board.toGrave(c, c.currentLocation));
			await me_spies.map(async c => await board.toGrave(c, c.currentLocation));
		},
		weight: (card, ai, max) => {
            let op_spies = card.holder.opponent().getAllRowCards().filter(c => c.isUnit() && c.abilities.includes("spy")).reduce((a,c) => a + c.power,0);
            let me_spies = card.holder.getAllRowCards().filter(c => c.isUnit() && c.abilities.includes("spy")).reduce((a, c) => a + c.power,0);
			return Math.max(0, op_spies - me_spies);
		}
	},
	cyprian_wiley: {
		description: "Chiếm quyền kiểm soát quân bài có sức mạnh thấp nhất ở hàng Cận Chiến của đối phương.",
		activated: async card => {
			let opCloseRow = board.getRow(card, "close", card.holder.opponent());
			let meCloseRow = board.getRow(card, "close", card.holder);
			if (opCloseRow.isShielded())
				return;
			let units = opCloseRow.minUnits();
			if (units.length === 0)
				return;
			await Promise.all(units.map(async c => await c.animate("seize")));
			units.forEach(async c => {
				c.holder = card.holder;
				await board.moveToNoEffects(c, meCloseRow, opCloseRow);
			});
		},
		weight: (card) => {
			if (card.holder.opponent().getAllRows()[0].isShielded())
				return 0;
			return card.holder.opponent().getAllRows()[0].minUnits().reduce((a, c) => a + c.power, 0) * 2
		}
	},
	gudrun_bjornsdottir: {
		description: "Triệu hồi Thủy Thủ Đoàn của Flyndr",
		activated: async (card, player) => {
			let new_card = new Card("sy_flyndr_crew", card_dict["sy_flyndr_crew"], player);
			await board.addCardToRow(new_card, new_card.row, card.holder);
		},
		weight: (card, ai, max) => {
			return card.holder.getAllRows()[0].cards.length + Number(card_dict["sy_flyndr_crew"]["strength"]);
		}
	},
	cyrus_hemmelfart: {
		description: "Ra một thẻ Xiềng Dimeritum vào bất kỳ hàng nào của đối phương.",
		activated: async (card, player) => {
			player.endTurnAfterAbilityUse = false;
			ui.showPreviewVisuals(card);
			ui.enablePlayer(true);
			if (!(player.controller instanceof ControllerAI))
				ui.setSelectable(card, true);
		},
		weight: (card) => 20
	},
	azar_javed: {
		description: "Tiêu diệt quân Anh Hùng yếu nhất của đối phương (tối đa 1 lá).",
		activated: async (card, player) => {
			let heroes = player.opponent().getAllRowCards().filter(c => c.hero);
			if (heroes.length === 0)
				return;
			let target = heroes.sort((a, b) => a.power - b.power)[0];
			await target.animate("scorch", true, false)
			await board.toGrave(target, target.currentLocation);
		},
		weight: (card, ai, max) => {
			let heroes = card.holder.opponent().getAllRowCards().filter(c => c.hero);
			if (heroes.length === 0)
				return 0;
			return heroes.sort((a, b) => a.power - b.power)[0].power;
		}
	},
	bank: {
		name: "Bank",
		description: "Rút một lá bài từ bộ bài của bạn.",
		activated: async card => {
			card.holder.deck.draw(card.holder.hand);
			await board.toGrave(card, card.holder.hand);
		},
		weight: (card) => 20
	},
	witch_hunt: {
		name: "Witch Hunt",
		description: "Tiêu diệt quân bài yếu nhất ở hàng đối diện",
		placed: async card => {
			let row = card.currentLocation.getOppositeRow();
			if (row.isShielded() || game.scorchCancelled)
				return;
			let units = row.minUnits();
			await Promise.all(units.map(async c => await c.animate("scorch", true, false)));
			await Promise.all(units.map(async c => await board.toGrave(c, row)));
		}
    },
    zerrikanterment: {
        description: "Lượng tăng sức mạnh từ Tín Đồ được nhân đôi.",
        gameStart: () => game.whorshipBoost *= 2
    },
    baal_zebuth: {
        description: "Chọn 2 lá bài từ mộ bài của đối phương và xáo chúng trở lại vào bộ bài của họ.",
        activated: async (card) => {
            let grave = card.holder.opponent().grave;
            if (card.holder.controller instanceof ControllerAI) {
                let cards = grave.findCardsRandom(false,2);
                await Promise.all(cards.map(async c => await board.toDeck(c, c.holder.grave)));
                return;
            } else {
                try {
                    Carousel.curr.exit();
                } catch (err) { }
            }
            await ui.queueCarousel(grave, 2, (c, i) => board.toDeck(c.cards[i], c), () => true);
        },
        weight: (card) => {
            if (card.holder.opponent().grave.cards.length < 5)
                return 0;
            else
                return 20;
        }
    },
    rarog: {
        description: "Draw a random card from the discard pile to your hand (any card) and then shuffle the rest back into the deck.",
        activated: async (card) => {
            if (card.holder.grave.cards.length === 0)
                return;
            let grave = card.holder.grave;
            let c = grave.findCardsRandom(false, 1)[0];
            await board.toHand(c, c.holder.grave);
            Promise.all(card.holder.grave.cards.map(c => board.toDeck(c, card.holder.grave)));
        },
        weight: (card) => {
            let medics = card.holder.hand.cards.filter(c => c.abilities.includes("medic"));
            if (medics.length > 0 || card.holder.grave.cards.length == 0)
                return 0;
            else
                return 15;
        }
    },
    whorshipper: {
        name: "Whorshipper",
        description: "Boost by 1 all whorshipped units on your side of the board.",
        placed: async card => {
            if (card.isLocked())
                return;
            card.holder.effects["whorshippers"]++;
        },
        removed: async card => {
            if (card.isLocked())
                return;
            card.holder.effects["whorshippers"]--;
        },
        weight: (card) => {
            let wcards = card.holder.getAllRowCards().filter(c => c.abilities.includes("whorshipped"));
            return wcards.length * game.whorshipBoost;
        }
    },
    whorshipped: {
        name: "Whorshipped",
        description: "Boosted by 1 by all whorshippers present on your side of the board.",
    },
    inspire: {
        name: "Inspire",
        description: "All units with Inspire ability take the highest base strength of the Inspire units on your side of the board. Still affected by weather.",
    },
};
