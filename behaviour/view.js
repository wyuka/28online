'use strict';

function Repository() {
}

Repository.prototype = {

  getElementsByCategory: function(category) {
      return this[category];
  },

  getCategorySize: function(category) {
    if (this.hasOwnProperty(category)) {
      return this[category].length;
    } else {
      return 0;
    }
  },

  clearCategory: function(category) {
      this[category] = [];
  },

  createIfEmpty: function(category) {
    if (!(this.hasOwnProperty(category))) {
      this[category] = [];
    }
  },

  findElement: function(id, category) {
    var allElements = this.getElementsByCategory(category);
    var element =  _.find(allElements, function(e) { return e.data("id") == id; }); 
    return element;
  },

  removeElementFromCategory: function(id, category) {
    var allElements = this[category];
    var element =  _.find(allElements, function(e) { return e.data("id") == id; }); 
    this[category] = _.without(allElements, element);
    return element;
  },

  addElement: function(element, id, category) {
    this.createIfEmpty(category);
    element.data("id", id);
    this[category].push(element);
  }
};
function TextTask(element, text) {
    this.element = element;
    this.text = text;
    this.type = "TextTask";
};

TextTask.prototype = new AsyncTask;
TextTask.prototype.run = function() {
        //this.element.hide();
        this.element.attr({'text': this.text});
        this.element.attr({'opacity': '1','fill': '#fff'});
        this.finish();
};

function AnimationTask(element, attr, time, callback) {
  this.element = element;
  this.type = "AnimationTask";
  this.attr = attr;
  this.time = time;
  this.callback = callback;
};

AnimationTask.prototype = new AsyncTask;
AnimationTask.prototype.run = function() {
      var self = this;
      var compositeCallback = function () {
        if (self.callback) {
          self.callback.apply(this);
        }
        self.finish();
      };
      var animation = Raphael.animation(this.attr, this.time, ">", compositeCallback);
      try {
        this.element.show().stop().animate(animation);
      } catch (err) {
          console.log("error with animation");
      }
};

function CompositeAnimationTask(animationList) {
  this.animationList = animationList;
  this.type = "CompositeAnimationTask";
  this.animCount = animationList.length;
  this.finishedAnimCount = 0;
};

CompositeAnimationTask.prototype = new AsyncTask;
CompositeAnimationTask.prototype.run = function() {
      var self = this;

      var i;
      for (i in self.animationList) {
        var currAnim = self.animationList[i];
        var compositeCallback = function () {
          if (currAnim.callback) {
            currAnim.callback.apply(this);
            self.finishedAnimCount += 1;
            //console.debug("finishedAnimCount updated by ["+i+"] to ["+self.finishedAnimCount+"]" + " limit ["+self.animCount+"]");
            if (self.finishedAnimCount == self.animCount) {
              //console.debug("finishing composite anim by ["+i+"]" );
              self.finish();
            }
          }
        };
        var animation = Raphael.animation(currAnim.attr, currAnim.time, ">", compositeCallback);
        currAnim.element.show().stop().animate(animation);
      }
};

function View(game) {
    this.game = game;
    this.canvas = new Raphael('canvas', constants.WIDTH, constants.HEIGHT);
    this.repository = new Repository();
    this.taskQueue = new TaskQueue();
    this.splashVisible = false;
}

View.prototype = {

    setGame: function(game) {
      this.game = game;
    },

    getCanvas: function() {
      return this.canvas;
    },
    
    getRepository: function() {
      return this.repository;
    },

    preload: function() {
      this.drawProgressOverlay();
      var loader = this.initPxLoader(); 
      loader.start();
    },

    askPlayerName: function(callback) {
      var self = this;

      $('#welcomeModal').modal('show');
      $('#closePlayerName').click(function(event) {
        event.preventDefault();
        callback('');
        $('#welcomeModal').modal('hide');
        self.showSplash();
      });
      $('#formPlayerName').submit(function(event) {
        event.preventDefault();
        var playerName =  $('#inputPlayerName').val();
        callback(playerName);
        $('#welcomeModal').modal('hide');
        self.showSplash();
      });
    },

    askCall: function(callback, gameObject, minCall) {
        var self = this;
        
        console.log('typeof = ' + typeof minCall);
        $('#minCallValue').html(minCall);
        $('#inputCall').val(minCall);
        $('#callModal').modal('show');
        $('#passCall').click(function(event) {
            event.preventDefault();
            callback(gameObject, 0);
            $('#callModal').modal('hide');
        });
        $('#formCall').submit(function(event) {
            event.preventDefault();
            var call =  parseInt($('#inputCall').val());
            console.log('typeof call = ' + typeof call);
            if (call >= parseInt(minCall)) {
                callback(gameObject, call);
                $('#callModal').modal('hide');
            }
            else {
                alert("too low call");
            }
        });
    },

    drawProgressOverlay: function() {
      $('#canvas').hide();
      $('#progressOverlay').show();
    },

    updateProgressOverlay: function(e) {
      var percentage = 0;
      if (e.totalCount !== null) {
        percentage = Math.floor(100.0*e.completedCount / e.totalCount);
      }
      $('#progressBar').css('width', percentage + '%');
    },

    clearProgressOverlay: function() {
      $('#progressOverlay').hide();
      $('#canvas').show();
    },

    showSplash: function() {
      if (!this.splashVisible) {
        this.splashVisible = true;
        console.debug("Drawing new splash");

        var bg = this.getCanvas().rect(0, 0, constants.WIDTH, constants.HEIGHT);
        bg.attr({fill: '45-#000-#555'});
        this.repository.addElement(bg, "splashBackground", "splash");

        var logoText = this.getCanvas().text(constants.WIDTH/2, constants.HEIGHT/2, messages[conf.lang].gameTitle);
        logoText.attr({'fill' : '#fff', 'font-size' : '32', 'font-family' : conf.font, 'font-weight' : 'bold','stroke-width' : '1'});
        this.repository.addElement(logoText, "logoText", "splash");

        var subText = this.getCanvas().text(constants.WIDTH/2, 40 + constants.HEIGHT/2, messages[conf.lang].clickToStart);
        subText.attr({'fill' : '#fff', 'font-size' : '24', 'font-family' : conf.font, 'font-weight' : 'bold','stroke-width' : '1'});
        this.repository.addElement(subText, "subText", "splash");

        this.waitForStartGame();
      } else {
        console.debug("Splash already visible, not drawing");
      }
    },

    drawBackground: function() {
      this.clearAllFromCategory("splash");
      var bg = this.getCanvas().rect(0, 0, constants.WIDTH, constants.HEIGHT);
      bg.attr({fill: '45-#000-#555'});

      var table = this.getCanvas().image(this.getTableImageFile(), constants.TABLE_X, constants.TABLE_Y, constants.TABLE_WIDTH, constants.TABLE_HEIGHT);
      
      var cardArea = this.getCanvas().rect(0, constants.CARD_AREA_Y, constants.WIDTH, constants.CARD_AREA_HEIGHT);
      cardArea.attr({'fill': '90-#161:5-#000:95', 'fill-opacity': 0.5, 'stroke-width': 0, 'opacity': 0.1});
    },
  
    initPxLoader: function() {
      var self = this;

      var loader = new PxLoader();
      var tableImage = this.getTableImageFile();
      loader.addImage(tableImage);

      var deckImage = this.getDeckImageFile();
      loader.addImage(deckImage);
  
      var teamName; 
      for (teamName in conf.teamFlags) { 
        var teamImageFile = this.getTeamImageFile(teamName);
        var smallTeamImageFile = this.getTeamImageFile(teamName, 'small');
        loader.addImage(teamImageFile);
        loader.addImage(smallTeamImageFile);
      }
      
      var suit; 
      var i;
      for (suit in constants.SUIT_TRANSLATION_TABLE) {
        for(i=2; i < 15; i++) {
          var cardImageFile = this.getCardImageFile(i, suit);
          loader.addImage(cardImageFile);
        }
      }

      var trumpSuit;
      for (trumpSuit in conf.suitIcons) {
        var iconImage = this.getSuitImageFile(trumpSuit);
        loader.addImage(iconImage);
      }

      var charCode;
      var num;
      for(charCode=65; charCode < 80; charCode++) {
        for(num=1; num < 6; num++) {
          var letter = String.fromCharCode(charCode);
          var avatarImage = this.getAvatarImageFile(letter, num);
          loader.addImage(avatarImage);
        }
      }

      loader.addCompletionListener(function() {
          self.clearProgressOverlay();
          self.showSplash();
      });

      loader.addProgressListener(function(e) {
          self.updateProgressOverlay(e);
      });

      return loader;
    },

  drawSubText: function(subscript, x, y) {
    var self = this;
    console.debug("drawSubText: " + subscript);

    var subText = this.repository.findElement("subText","text");
    if (subText) {
      subText.attr({'text': subscript});
    } else {
      subText = this.getCanvas().text(x, y, subscript);
      subText.attr({'fill' : '#fff', 'font-size' : '16', 'font-family' : conf.font, 'font-weight' : 'bold','stroke-width' : '1'});
      this.repository.addElement(subText, "subText", "text");
    }
    subText.hide();
    this.queueAnimate(subText, {'opacity': 1}, 100); 
  },

  drawMainText: function(content, x, y) {
    var mainText = this.repository.findElement("mainText", "text");
    if (mainText) {
      mainText.attr({'text': content});
    } else {
      mainText = this.getCanvas().text(x, y, content);
      mainText.attr({'fill' : '#fff', 'font-size' : '22', 'font-family' : conf.font, 'font-weight' : 'bold','stroke-width' : '1'});
      this.repository.addElement(mainText, "mainText", "text");
    }
    mainText.hide();
    this.queueAnimate(mainText, {'opacity': 1}, 100); 
  },

  countNewLines: function(content) {
    var matches = content.match(/\n/);
    var newLineCount = matches === null ? 1 : matches.length+1;
    console.debug("content [" + content + "] has newLineCount [" + newLineCount + "]");
    return newLineCount;
  },

  drawText: function(content, subscript) {
    //TODO: move to constants
    var x = constants.WIDTH * 0.78;
    var y = constants.HEIGHT * 0.7;

    this.drawMainText(content, x, y);

    var newLineCount = this.countNewLines(content);
    var subY = y + (newLineCount*36);
    console.debug("subY"+ subY);
    this.drawSubText(subscript, x, subY);
  },

  

  drawInvalidText: function(content) {
    //TODO: move to constants
    var x = constants.WIDTH * 0.2;
    var y = constants.HEIGHT * 0.7;

    if (this.invalidText) {
      this.invalidText.attr({'text': content});
    } else {
      this.invalidText = this.getCanvas().text(x, y, content);
      this.invalidText.attr({'fill' : '#f00', 'font-size' : '22', 'font-family' : conf.font, 'font-weight' : 'bold','stroke-width' : '1'});
    }
    this.invalidText.hide();
    console.debug("Draw invalid text");
    this.queueAnimate(this.invalidText, {'opacity': 1}, 100); 
  },

  drawError: function(heading, message) {
    console.debug("Drawing invalid text: " + heading);
    this.drawInvalidText(heading);
  },

  clearError: function() {
    console.debug("Clearing invalid text");
    this.drawInvalidText("");
  },

  drawTrumpSuit: function(trumpSuit) {
    var content = "Trump"; 
    var trumpSuitText = this.getCanvas().text(constants.TRUMPSUIT_PADDING, constants.TRUMPSUIT_PADDING, content);
    trumpSuitText.attr({'font-size': 20,'text-anchor': 'start','fill': '#fff','font-family' : conf.font, 'font-weight' : 'bold'});
    var iconImage = this.getSuitImageFile(trumpSuit);
    var trumpSuitIcon = this.getCanvas().image(iconImage, constants.TRUMPSUIT_X, constants.TRUMPSUIT_Y, constants.TRUMPSUIT_SIZE, constants.TRUMPSUIT_SIZE);
    this.repository.addElement(trumpSuitText, "trumpSuitText", "trumpSuit");
    this.repository.addElement(trumpSuitIcon, "trumpSuitIcon", "trumpSuit");
  },

  clearTrumpSuit: function() {
    this.clearAllFromCategory("trumpSuit");
  },

  drawDeck: function() {
    var image = this.getDeckImageFile();
    var deck = this.getCanvas().image(image, constants.DECK_X, constants.DECK_Y, constants.DECK_WIDTH, constants.DECK_HEIGHT);
    this.repository.addElement(deck, "tableDeck", "deck");
  },

  clearDeck: function() {
    this.clearAllFromCategory("deck");
  },

  clearAllFromCategory: function(category) {
    var list = this.repository.getElementsByCategory(category);
    _.each(list, function(el) {
      el.remove();
    });
    this.repository.clearCategory(category);
  },

  drawInitialScores: function(teams) {
    var canvas = this.getCanvas();
    var scoreTitle = canvas.text(constants.SCORE_FLAG_X[0], 10, messages[conf.lang].score);
    scoreTitle.attr({'font-size': constants.SCORE_FONT_SIZE,'text-anchor': 'start','fill': '#fff','font-family' : conf.font, 'font-weight' : 'bold'});

    var i;
    for (i in teams) {
      var smallTeamImage = this.getTeamImageFile(teams[i], 'small');
      canvas.image(smallTeamImage, constants.SCORE_FLAG_X[i], constants.SCORE_FLAG_Y[i], constants.SCORE_FLAG_SIZE, constants.SCORE_FLAG_SIZE);
      var scoreText = canvas.text(constants.SCORE_FLAG_X[i]+constants.SCORE_FLAG_SIZE+ constants.SCORE_TEXT_PADDING, constants.SCORE_FLAG_Y[i]+constants.SCORE_TEXT_PADDING, "0").attr({'font-size': constants.SCORE_FONT_SIZE,'text-anchor': 'start','fill': '#fff','font-family' : conf.font, 'font-weight' : 'bold'});
      scoreText.id = teams[i];
      this.repository.addElement(scoreText,teams[i],"scoreText");
    }
  },

  updateScores: function(scores) {
    var teamScores = scores['teamScore'];

    var team;
    for (team in teamScores) {
      var textElement = this.repository.findElement(team, "scoreText");
      var oldText = textElement.attr('text');
      var newText = teamScores[team];
      if (oldText != newText) {
        console.debug("updating scores");
        this.queueText(textElement, newText);
      }
    }
  },

  drawHumanPlayerCards: function(cards) {
    var self = this;
    var category = "playerCards";

    var numExistingCards = this.repository.getCategorySize('playerCards');
    var numCards = cards.length + numExistingCards;
    console.debug("numExistingCards " + numExistingCards + " numCards " + numCards);
    var stepSize = constants.CARD_WIDTH + constants.CARD_PADDING;
    var offset = (constants.CARD_AREA_WIDTH - (numCards * stepSize))/2;
    var newCardsOffset = offset + (numExistingCards * stepSize);
    console.debug("offset " + offset + " newCardsOffset " + newCardsOffset + " stepSize " + stepSize);

    if (numExistingCards > 0) {
      var oldOffset = (constants.CARD_AREA_WIDTH - (numExistingCards * stepSize))/2;
      var dx = offset - oldOffset;
      console.debug("oldOffset " + oldOffset + " dx " + dx);
      var existingCards = this.repository.getElementsByCategory('playerCards');
      _.each(existingCards, function(c) {
        c.translate(dx, 0);
      });
    }

    if (numCards > 0) {

    var compositeAnimation = [];
      _.each(cards, function(card, i) {
        var startX = constants.DECK_X;
        var startY = constants.DECK_Y;
        var endX = (i * stepSize) + newCardsOffset;
        var endY = constants.CARD_AREA_Y + constants.CARD_AREA_PADDING;

        var cardId = self.getCardId(card, category);
        var cardImage = self.drawCard(card, startX, startY, constants.CARD_WIDTH, constants.CARD_HEIGHT, category);
        cardImage.hide();
        self.queueAnimate(cardImage, {x: endX, y: endY}, constants.PLAYER_CARD_ANIMATE_TIME);
        self.repository.addElement(cardImage, cardId, category);
      });
    }
  },
  
  drawOtherPlayerCards: function(playerIndex, num) {
    var startX = constants.DECK_X;
    var startY = constants.DECK_Y;
    var endX = constants.PLAYER_X_ARR[playerIndex];
    var endY = constants.PLAYER_Y_ARR[playerIndex];
    var deckImage = this.getDeckImageFile();

    var self = this;
    var compositeAnimation = [];

    _.times(num, function() {
      var deckEl = self.getCanvas().image(deckImage, startX, startY, constants.DECK_WIDTH, constants.DECK_HEIGHT);
      deckEl.hide();

      compositeAnimation.push({'element': deckEl, 'attr': {x: endX, y: endY}, 'time': constants.PLAYER_CARD_ANIMATE_TIME, 'callback': deckEl.remove});
      //self.queueAnimate(deckEl, {x: endX, y: endY}, constants.PLAYER_CARD_ANIMATE_TIME, deckEl.remove);
    });
    self.queueCompositeAnimation(compositeAnimation);
  },

  drawDealCards: function(cards, playingOrder, num) {
      var index;
      for (index in playingOrder) {
        if (index == 0) {
          this.drawHumanPlayerCards(cards);
        } else {
          this.drawOtherPlayerCards(index, 4);
        }
      }
  },

  drawPlayerCards: function(cards, playingOrder) {
    var self = this;

    if (cards.length == 0) {
      return;
    } else if (cards.length == 4) {
      this.drawDealCards(cards, playingOrder, 4);
    } else {
      var i;
      var offset = 4;
      var step = 4;
      for (i=0; i < 2; i++) {
        var start = offset + i * step;
        var end = start + step; 
        var currentCards = cards.slice(start, end);
        this.drawDealCards(currentCards, playingOrder, 4);
      }
    }
  },
  
  queueText: function(obj, text) {
    var task = new TextTask(obj, text);
    this.taskQueue.addTask(task);
  },

  queueAnimate: function(obj, attr, time, callback) {
    var task = new AnimationTask(obj, attr, time, callback);
    this.taskQueue.addTask(task);
  },

  queueCompositeAnimation: function(animationList) {
    var task = new CompositeAnimationTask(animationList);
    this.taskQueue.addTask(task);
  },

  drawPlayerMove: function(playerMove) {
    var category = "playerMoves";

    var player = playerMove.getPlayer();
    var card = playerMove.getCard();
    var playerIndex = player.getIndex(); 

    var startX = constants.PLAYER_X_ARR[playerIndex];
    var startY = constants.PLAYER_Y_ARR[playerIndex];

    var endX = constants.CARD_X_ARR[playerIndex];
    var endY = constants.CARD_Y_ARR[playerIndex];

    var cardId = this.getCardId(card, category);
    var cardImage = this.drawCard(card, startX, startY, constants.CARD_WIDTH, constants.CARD_HEIGHT, category);
    cardImage.hide();
    console.debug("Drawing playerMove"); 
    this.queueAnimate(cardImage, {x: endX, y: endY}, constants.PLAYER_MOVE_ANIMATE_TIME);
    this.repository.addElement(cardImage, cardId, category);
  },

  clearPlayerMoves: function() {
    console.debug("Clearing all playerMoves");
    var playerMoves = this.repository.getElementsByCategory('playerMoves');
    _.each(playerMoves, function (pm) { 
      pm.remove(); 
    });
    this.repository.clearCategory('playerMoves');
  },

  clearAnimationQueue: function() {
    this.taskQueue.q = [];
    this.taskQueue.state = "INITIALIZED";
  },

  getCardId: function(card, category) {
    var id = category + "_" + card.rank + "_" + card.suit;
    return id;
  },

  removePlayerCard: function(card) {
    var id = this.getCardId(card,'playerCards');
    var cardImage = this.repository.removeElementFromCategory(id, 'playerCards');
    cardImage.remove();
  },

  clearPlayerCards: function() {
    var playerCards = this.repository.getElementsByCategory('playerCards');
    _.each(playerCards, function(c) { c.remove(); });
    this.repository.clearCategory("playerCards");
  },

  drawCard: function(card, x, y, width, height, category) {
    var self = this;
    var cardImage = this.getCanvas().image(this.getCardImageFile(card.rank, card.suit), x, y, width, height);

    cardImage.mouseover(function(event) {
        try {
            this.translate(0,-1*constants.CARD_HEIGHT);
            this.attr({'height': constants.CARD_HEIGHT * 2, 'width': constants.CARD_WIDTH * 2});
            this.toFront();
        } catch (err) {}
    });
    cardImage.mouseout(function(event) {
        try {
            this.translate(0,constants.CARD_HEIGHT);
            this.attr({'height': constants.CARD_HEIGHT, 'width': constants.CARD_WIDTH});
            self.clearError();
        } catch (err) {}
    });

    cardImage.click(function(event) {
        console.log("DEBUG in cardImage clickEventHandler");
        self.game.handleCardClicked(card);
    });

    cardImage.id = this.getCardId(card, category);
    return cardImage;
  },

  drawPlayer: function(player) {
    var canvas = this.getCanvas();
    var playerX = constants.PLAYER_X_ARR[player.getIndex()];
    var playerY = constants.PLAYER_Y_ARR[player.getIndex()];

    var flagX = playerX - 0.25*constants.TEAM_FLAG_SIZE;
    var flagY = playerY - 0.25*constants.TEAM_FLAG_SIZE;

    var textX  = constants.TEXT_X_ARR[player.getIndex()];
    var textY = constants.TEXT_Y_ARR[player.getIndex()];

    var teamName = player.getTeamName();
    var teamImage = this.getTeamImageFile(teamName);
    var teamFlag = canvas.image(teamImage, flagX, flagY,  constants.TEAM_FLAG_SIZE, constants.TEAM_FLAG_SIZE);

    var playerImage = canvas.image(this.getPlayerImageFile(), playerX, playerY, constants.PLAYER_SIZE, constants.PLAYER_SIZE);

    var playerName = player.getName();
    var nameTxt = canvas.text(textX, textY , playerName);
    nameTxt.attr({'fill' : '#fff', 'font-size' : '14', 'font-family' : conf.font, 'font-weight' : 'bold', 'fill-opacity' : '50%'});
  },
  
  waitForEvent: function(callback) {
    var self = this;

    var overlay = this.getCanvas().rect(0, 0, constants.WIDTH, constants.HEIGHT);
    overlay.attr({fill: "#000", stroke: "none", opacity: '0'}); 
    overlay.hide();

    console.debug("Animating overlay");
    this.queueAnimate(overlay, {opacity: '0'}, 100, function() {
      var timeoutId = setTimeout(function() {
        self.game[callback]();
        console.debug("Timeout kicked in"); 
        overlay.remove();
      }, 5000);

      overlay.mouseup(function(event) {
        clearTimeout(timeoutId);
        self.game[callback]();
        console.debug("Removing overlay"); 
        overlay.remove();
      }); 

    });
  },
  
  waitForStartGame: function() {
    var callback = 'init';
    this.waitForEvent(callback);  
  },

  waitForNextHand: function() {
    var callback = 'sendReady';
    this.waitForEvent(callback);  
  },

  waitForNextGame: function() {
    var callback = 'nextGame';
    this.waitForEvent(callback);  
  },
  
  getCardImageFile : function(rank, suit) {
    return conf.cardsDirectory + 'simple_' + constants.SUIT_TRANSLATION_TABLE[suit] + '_' + constants.RANK_TRANSLATION_TABLE[rank] + '.png';
  },
  
  getPlayerImageFile: function() {
    var charCode = Math.floor(Math.random() * 15) + 65;
    var letter = String.fromCharCode(charCode);
    var number = Math.floor(Math.random() * 5) + 1;
    return this.getAvatarImageFile(letter, number);
  },

  getAvatarImageFile: function(letter, num) {
    return conf.avatarDirectory + letter + '0' + num + '.png';
  },

  getTeamImageFile: function(teamName, size) {
    if (!(teamName in conf.teamFlags)) {
      teamName = 'default';
    }

    var flagDir;
    if (size == 'small') {
      flagDir = conf.flagSmallDir;
    } else {
      flagDir = conf.flagDir;
    }
    return flagDir + conf.teamFlags[teamName];
  },

  getSuitImageFile: function(trumpSuit) {
    return conf.suitsDirectory + conf.suitIcons[trumpSuit];
  },

  getTableImageFile: function() {
    return conf.imageDir + 'green_poker_skin.png';
  },

  getDeckImageFile: function() {
    return conf.imageDir + 'card_back.png';
  }
};
