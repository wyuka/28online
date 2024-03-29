'use strict';

function Game() {
    this.view = null;
    this.handler = null;

    this.cards = [];
    this.players = [];
    this.playerMoves = [];
    this.playingOrder = [];
    this.selectedCard = null;
    this.playerName = null;
    this.playerTeam = null;
    this.cpuTeam = null;
    this.humanId = null;
    this.firstHand = null;
    this.firstCard = null;
}

Game.prototype = {

  init: function() {
    this.handler.connect();
    this.view.drawBackground();
    this.initScores();
  },

  start: function() {
    this.handler.sendMessage({'command' : 'startGame', 'playerName' : this.playerName, 'playerTeam': this.playerTeam, 'opponentTeam': this.cpuTeam});
  },

  nextGame: function() {
    this.handler.sendMessage({'command' : 'nextGame', 'playerName' : this.playerName, 'playerTeam': this.playerTeam, 'opponentTeam': this.cpuTeam});
  },

  getGameInfo: function() {
    this.handler.sendMessage({'command' : 'getGameInfo'});
  },
  
  askFirstCards: function fn_askFirstCards () {
    this.handler.sendMessage({ 'command' : 'dealFirstCards', 'playerId' : this.humanPlayer.id});
  },

  sendReadyForCall: function() {
    this.handler.sendMessage({ 'command' : 'readyForCall', 'playerId' : this.humanPlayer.id});
  },

  makeCall: function (self, call) {
    self.handler.sendMessage({ 'command' : 'makeCall', 'playerId' : self.humanPlayer.id, 'call' : call});
  },

  chooseTrump: function fn_chooseTrump (card) {
    this.trumpSuit = card.suit;
    this.handler.sendMessage({'command' : 'chooseTrump', 'suit': card.suit, 'playerId' : this.humanPlayer.id});
  },

  askAllCards: function () {
      this.handler.sendMessage({ 'command' : 'dealAllCards', 'playerId' : this.humanPlayer.id});
  },

  makeMove: function fn_makeMove (card) {
    this.handler.sendMessage({'command' : 'makeMove', 'rank' : card.rank, 'suit': card.suit, 'playerIndex' : 0, 'playerId' : this.humanPlayer.id});
    this.selectedCard = card;
    this.setCardClickHandler(this.noAction);
  },

  noAction: function fn_noAction (card) {
    this.view.drawText('Not now.\nChill for a bit ...', '');
  },

  sendReady: function() {
    this.handler.sendMessage({'command' : 'isReady', 'playerId' : this.humanPlayer.id});
  },

  addCards: function(newCards) {
    console.debug("Before addCards cards size: " + this.cards.length);
    this.cards = this.cards.concat(newCards);
    this.cards = _.uniq(this.cards, false, function(c) {
      return c.suit + '_' + c.rank;
    });
    console.debug("After addCards cards size: " + this.cards.length);
    //this.sortCards();
  },

  sortCards: function() {
    var grouped = _.groupBy(this.cards, 'suit'); 
    _.each(grouped, function(cardList, index, list) {
      var sorted = _.sortBy(cardList, function(c) { return c.rank; });
      list[index] = sorted; 
    });
    var flattened = _.flatten(grouped);
    this.cards = flattened;
  },
  
  addPlayer: function(player) {
    if (player.isHuman) {
      this.humanPlayer = player;
    }
    this.players.push(player);
  },

  getPlayerById: function(id) {
    var player = _.find(this.players, function (p) { return p.id == id;});
    return player;
  },

  removeSelectedCard: function() {
    this.removeCard(this.selectedCard);
  },

  removeCard: function(card) {
    this.view.removePlayerCard(card);
    this.cards = _.without(this.cards, card);
   },

  clearCards: function() {
    this.view.clearPlayerCards();
    this.cards.length = 0;
  },

  drawTrumpSuit: function(trumpSuit) {
    this.view.drawTrumpSuit(this.trumpSuit);
  },
  
  drawText: function(text, subscript) {
    this.view.drawText(text, subscript);
  },

  drawError: function(heading, text) {
    this.view.drawError(heading, text);
  },

  clearError: function(text) {
    this.view.clearError(text);
  },

  drawPlayer: function(player) {
    this.view.drawPlayer(player);
  },

  clearMoves: function(moves) {
    this.view.clearPlayerMoves();
    this.playerMoves.length = 0;
  },
  
  addAndDrawMoves : function(moves) {
    var self = this;
    var existingMoves = this.playerMoves;
    var currentStep = existingMoves.length;

    _.each(moves, function(move, index, list) {
      if (move.sequenceNumber > currentStep) {
        console.log("bilkul bakchod " + move.getCard().rank);
        self.playerMoves.push(move);
        self.view.drawPlayerMove(move);
      }
    });
  },
  
  initScores: function() {
    this.view.drawInitialScores([this.playerTeam, this.cpuTeam]);
  },

  updateScores: function(scores) {
    this.view.updateScores(scores);
  },

  handleFirstCards: function(cards) {
    this.addCards(cards);
    this.view.drawDeck();
    this.view.drawPlayerCards(this.cards, this.playingOrder);
    this.sendReadyForCall();
  },

  handleAskCall: function(minCall) {
      this.view.askCall(this.makeCall, this, minCall);
  },

  handleCallMade: function(playerId, call) {
    if (playerId == this.humanPlayer.id) {
        if (call == 'pass')
            this.drawText(messages[conf.lang].youPassed, "");
        else
            this.drawText(messages[conf.lang].youMadeCall + call, "");
    } else {
        var player = this.getPlayerById(playerId);
        if (call == 'pass')
            this.drawText(player.getName() + messages[conf.lang].otherPassed, "");
        else
            this.drawText(player.getName() + messages[conf.lang].otherMadeCall + call, "");
    }
    this.sendReadyForCall();
  },

  handleCallWon: function(playerId, call) {
      if (playerId == this.humanPlayer.id) {
          this.drawText(messages[conf.lang].youWinCall + call, messages[conf.lang].chooseTrumpHeading);
          this.setCardClickHandler(this.chooseTrump);
      }
      else {
          var player = this.getPlayerById(playerId);
          this.drawText(player.getName() + messages[conf.lang].otherWinsCall + call, "");
      }
  },

  handleTrumpChosen: function() {
      this.drawText("","");
      this.setCardClickHandler(this.noAction);
      this.askAllCards();
  },
  
  handleAllCards: function(cards) {
    this.addCards(cards);
    this.view.drawPlayerCards(this.cards, this.playingOrder);
    this.view.clearDeck();
    this.firstCard = true;
    this.firstHand = true;
    this.sendReady();
  },

  handleAskMove: function () {
    if (this.firstCard == true && this.firstHand == false) {
        this.drawText(messages[conf.lang].youWinHand + "\n" + messages[conf.lang].yourTurn, "");
    }
    else {
        this.drawText(messages[conf.lang].yourTurn, "");
    }
    this.setCardClickHandler(this.makeMove);
  },

  handleInvalidMove: function (response) {
    this.drawError(messages[conf.lang].invalidMoveHeading, messages[conf.lang].invalidMove); 
    this.setCardClickHandler(this.makeMove);
  },

  handleMoveMade: function (playerMoves, playerId) {
    if (this.firstCard == true && this.firstHand == false) {
        this.clearMoves();
        this.view.clearAnimationQueue();
        this.firstCard = false;
    }
    if (playerId == this.humanPlayer.id) {
        console.log("move successful");
        this.removeSelectedCard();
        this.clearError();
    }

    this.drawText("", "");
    this.addAndDrawMoves(playerMoves);
    this.sendReady();
  },

  handleHandPlayed: function (winningPlayerId, scores) {

    var winningPlayer = this.getPlayerById(winningPlayerId);
    if (winningPlayer.id == this.humanPlayer.id) {
      this.drawText(messages[conf.lang].youWinHand, "");
    } else {
      this.drawText(winningPlayer.name + messages[conf.lang].otherWinsHand, "");
    }

    this.updateScores(scores);
    this.firstCard = true;
    this.firstHand = false;
    this.sendReady();
    //this.view.waitForNextHand();
    //this.clearMoves();
  },

  handleGameDecided: function (winningTeam, scores) {
    this.drawText(messages[conf.lang].gameDecided + winningTeam, "");
    this.updateScores(scores);
    this.view.waitForNextGame();
  },

  handleNextGame: function(cards) {
    this.clearCards();
    this.clearMoves();
    this.view.clearTrumpSuit();
    this.askFirstCards();
  },

  handleCardClicked : function(card) {
    this.cardClickHandler(card);
  },

  setCardClickHandler : function(handler) {
    console.debug("Setting cardClickHandler to: " + handler.name);
    this.cardClickHandler = handler;
  },
  
  setPlayerTeam: function(playerTeam) {
    this.playerTeam = playerTeam;
  },
  
  setCpuTeam: function(cpuTeam) {
    this.cpuTeam = cpuTeam;
  },
  
  setPlayerName: function(playerName) {
    if (playerName != null && playerName != '') {
      this.playerName = playerName;
    } else {
      var code = "" + (Math.floor(Math.random() * 2500) + 1);
      this.playerName = messages[conf.lang].playerPrefix + code;
    }
  },

  setView: function(view) {
    this.view = view;
  },

  setMessageHandler: function(handler) {
    this.handler = handler;
  }
};
