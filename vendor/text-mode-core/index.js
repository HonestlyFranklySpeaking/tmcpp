var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../dsm/node_modules/moo/moo.js
var require_moo = __commonJS({
  "../dsm/node_modules/moo/moo.js"(exports, module) {
    (function(root, factory) {
      if (typeof define === "function" && define.amd) {
        define([], factory);
      } else if (typeof module === "object" && module.exports) {
        module.exports = factory();
      } else {
        root.moo = factory();
      }
    })(exports, function() {
      "use strict";
      var hasOwnProperty = Object.prototype.hasOwnProperty;
      var toString = Object.prototype.toString;
      var hasSticky = typeof new RegExp().sticky === "boolean";
      function isRegExp(o) {
        return o && toString.call(o) === "[object RegExp]";
      }
      function isObject(o) {
        return o && typeof o === "object" && !isRegExp(o) && !Array.isArray(o);
      }
      function reEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      }
      function reGroups(s) {
        var re = new RegExp("|" + s);
        return re.exec("").length - 1;
      }
      function reCapture(s) {
        return "(" + s + ")";
      }
      function reUnion(regexps) {
        if (!regexps.length) return "(?!)";
        var source = regexps.map(function(s) {
          return "(?:" + s + ")";
        }).join("|");
        return "(?:" + source + ")";
      }
      function regexpOrLiteral(obj) {
        if (typeof obj === "string") {
          return "(?:" + reEscape(obj) + ")";
        } else if (isRegExp(obj)) {
          if (obj.ignoreCase) throw new Error("RegExp /i flag not allowed");
          if (obj.global) throw new Error("RegExp /g flag is implied");
          if (obj.sticky) throw new Error("RegExp /y flag is implied");
          if (obj.multiline) throw new Error("RegExp /m flag is implied");
          return obj.source;
        } else {
          throw new Error("Not a pattern: " + obj);
        }
      }
      function pad(s, length) {
        if (s.length > length) {
          return s;
        }
        return Array(length - s.length + 1).join(" ") + s;
      }
      function lastNLines(string, numLines) {
        var position = string.length;
        var lineBreaks = 0;
        while (true) {
          var idx = string.lastIndexOf("\n", position - 1);
          if (idx === -1) {
            break;
          } else {
            lineBreaks++;
          }
          position = idx;
          if (lineBreaks === numLines) {
            break;
          }
          if (position === 0) {
            break;
          }
        }
        var startPosition = lineBreaks < numLines ? 0 : position + 1;
        return string.substring(startPosition).split("\n");
      }
      function objectToRules(object) {
        var keys = Object.getOwnPropertyNames(object);
        var result = [];
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          var thing = object[key];
          var rules2 = [].concat(thing);
          if (key === "include") {
            for (var j = 0; j < rules2.length; j++) {
              result.push({ include: rules2[j] });
            }
            continue;
          }
          var match = [];
          rules2.forEach(function(rule) {
            if (isObject(rule)) {
              if (match.length) result.push(ruleOptions(key, match));
              result.push(ruleOptions(key, rule));
              match = [];
            } else {
              match.push(rule);
            }
          });
          if (match.length) result.push(ruleOptions(key, match));
        }
        return result;
      }
      function arrayToRules(array) {
        var result = [];
        for (var i = 0; i < array.length; i++) {
          var obj = array[i];
          if (obj.include) {
            var include = [].concat(obj.include);
            for (var j = 0; j < include.length; j++) {
              result.push({ include: include[j] });
            }
            continue;
          }
          if (!obj.type) {
            throw new Error("Rule has no type: " + JSON.stringify(obj));
          }
          result.push(ruleOptions(obj.type, obj));
        }
        return result;
      }
      function ruleOptions(type, obj) {
        if (!isObject(obj)) {
          obj = { match: obj };
        }
        if (obj.include) {
          throw new Error("Matching rules cannot also include states");
        }
        var options = {
          defaultType: type,
          lineBreaks: !!obj.error || !!obj.fallback,
          pop: false,
          next: null,
          push: null,
          error: false,
          fallback: false,
          value: null,
          type: null,
          shouldThrow: false
        };
        for (var key in obj) {
          if (hasOwnProperty.call(obj, key)) {
            options[key] = obj[key];
          }
        }
        if (typeof options.type === "string" && type !== options.type) {
          throw new Error("Type transform cannot be a string (type '" + options.type + "' for token '" + type + "')");
        }
        var match = options.match;
        options.match = Array.isArray(match) ? match : match ? [match] : [];
        options.match.sort(function(a, b) {
          return isRegExp(a) && isRegExp(b) ? 0 : isRegExp(b) ? -1 : isRegExp(a) ? 1 : b.length - a.length;
        });
        return options;
      }
      function toRules(spec) {
        return Array.isArray(spec) ? arrayToRules(spec) : objectToRules(spec);
      }
      var defaultErrorRule = ruleOptions("error", { lineBreaks: true, shouldThrow: true });
      function compileRules(rules2, hasStates) {
        var errorRule = null;
        var fast = /* @__PURE__ */ Object.create(null);
        var fastAllowed = true;
        var unicodeFlag = null;
        var groups = [];
        var parts = [];
        for (var i = 0; i < rules2.length; i++) {
          if (rules2[i].fallback) {
            fastAllowed = false;
          }
        }
        for (var i = 0; i < rules2.length; i++) {
          var options = rules2[i];
          if (options.include) {
            throw new Error("Inheritance is not allowed in stateless lexers");
          }
          if (options.error || options.fallback) {
            if (errorRule) {
              if (!options.fallback === !errorRule.fallback) {
                throw new Error("Multiple " + (options.fallback ? "fallback" : "error") + " rules not allowed (for token '" + options.defaultType + "')");
              } else {
                throw new Error("fallback and error are mutually exclusive (for token '" + options.defaultType + "')");
              }
            }
            errorRule = options;
          }
          var match = options.match.slice();
          if (fastAllowed) {
            while (match.length && typeof match[0] === "string" && match[0].length === 1) {
              var word = match.shift();
              fast[word.charCodeAt(0)] = options;
            }
          }
          if (options.pop || options.push || options.next) {
            if (!hasStates) {
              throw new Error("State-switching options are not allowed in stateless lexers (for token '" + options.defaultType + "')");
            }
            if (options.fallback) {
              throw new Error("State-switching options are not allowed on fallback tokens (for token '" + options.defaultType + "')");
            }
          }
          if (match.length === 0) {
            continue;
          }
          fastAllowed = false;
          groups.push(options);
          for (var j = 0; j < match.length; j++) {
            var obj = match[j];
            if (!isRegExp(obj)) {
              continue;
            }
            if (unicodeFlag === null) {
              unicodeFlag = obj.unicode;
            } else if (unicodeFlag !== obj.unicode && options.fallback === false) {
              throw new Error("If one rule is /u then all must be");
            }
          }
          var pat = reUnion(match.map(regexpOrLiteral));
          var regexp = new RegExp(pat);
          if (regexp.test("")) {
            throw new Error("RegExp matches empty string: " + regexp);
          }
          var groupCount = reGroups(pat);
          if (groupCount > 0) {
            throw new Error("RegExp has capture groups: " + regexp + "\nUse (?: \u2026 ) instead");
          }
          if (!options.lineBreaks && regexp.test("\n")) {
            throw new Error("Rule should declare lineBreaks: " + regexp);
          }
          parts.push(reCapture(pat));
        }
        var fallbackRule = errorRule && errorRule.fallback;
        var flags = hasSticky && !fallbackRule ? "ym" : "gm";
        var suffix = hasSticky || fallbackRule ? "" : "|";
        if (unicodeFlag === true) flags += "u";
        var combined = new RegExp(reUnion(parts) + suffix, flags);
        return { regexp: combined, groups, fast, error: errorRule || defaultErrorRule };
      }
      function compile2(rules2) {
        var result = compileRules(toRules(rules2));
        return new Lexer({ start: result }, "start");
      }
      function checkStateGroup(g, name, map) {
        var state = g && (g.push || g.next);
        if (state && !map[state]) {
          throw new Error("Missing state '" + state + "' (in token '" + g.defaultType + "' of state '" + name + "')");
        }
        if (g && g.pop && +g.pop !== 1) {
          throw new Error("pop must be 1 (in token '" + g.defaultType + "' of state '" + name + "')");
        }
      }
      function compileStates(states, start) {
        var all = states.$all ? toRules(states.$all) : [];
        delete states.$all;
        var keys = Object.getOwnPropertyNames(states);
        if (!start) start = keys[0];
        var ruleMap = /* @__PURE__ */ Object.create(null);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          ruleMap[key] = toRules(states[key]).concat(all);
        }
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          var rules2 = ruleMap[key];
          var included = /* @__PURE__ */ Object.create(null);
          for (var j = 0; j < rules2.length; j++) {
            var rule = rules2[j];
            if (!rule.include) continue;
            var splice = [j, 1];
            if (rule.include !== key && !included[rule.include]) {
              included[rule.include] = true;
              var newRules = ruleMap[rule.include];
              if (!newRules) {
                throw new Error("Cannot include nonexistent state '" + rule.include + "' (in state '" + key + "')");
              }
              for (var k = 0; k < newRules.length; k++) {
                var newRule = newRules[k];
                if (rules2.indexOf(newRule) !== -1) continue;
                splice.push(newRule);
              }
            }
            rules2.splice.apply(rules2, splice);
            j--;
          }
        }
        var map = /* @__PURE__ */ Object.create(null);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          map[key] = compileRules(ruleMap[key], true);
        }
        for (var i = 0; i < keys.length; i++) {
          var name = keys[i];
          var state = map[name];
          var groups = state.groups;
          for (var j = 0; j < groups.length; j++) {
            checkStateGroup(groups[j], name, map);
          }
          var fastKeys = Object.getOwnPropertyNames(state.fast);
          for (var j = 0; j < fastKeys.length; j++) {
            checkStateGroup(state.fast[fastKeys[j]], name, map);
          }
        }
        return new Lexer(map, start);
      }
      function keywordTransform(map) {
        var isMap = typeof Map !== "undefined";
        var reverseMap = isMap ? /* @__PURE__ */ new Map() : /* @__PURE__ */ Object.create(null);
        var types = Object.getOwnPropertyNames(map);
        for (var i = 0; i < types.length; i++) {
          var tokenType = types[i];
          var item = map[tokenType];
          var keywordList = Array.isArray(item) ? item : [item];
          keywordList.forEach(function(keyword) {
            if (typeof keyword !== "string") {
              throw new Error("keyword must be string (in keyword '" + tokenType + "')");
            }
            if (isMap) {
              reverseMap.set(keyword, tokenType);
            } else {
              reverseMap[keyword] = tokenType;
            }
          });
        }
        return function(k) {
          return isMap ? reverseMap.get(k) : reverseMap[k];
        };
      }
      var Lexer = function(states, state) {
        this.startState = state;
        this.states = states;
        this.buffer = "";
        this.stack = [];
        this.reset();
      };
      Lexer.prototype.reset = function(data, info) {
        this.buffer = data || "";
        this.index = 0;
        this.line = info ? info.line : 1;
        this.col = info ? info.col : 1;
        this.queuedToken = info ? info.queuedToken : null;
        this.queuedText = info ? info.queuedText : "";
        this.queuedThrow = info ? info.queuedThrow : null;
        this.setState(info ? info.state : this.startState);
        this.stack = info && info.stack ? info.stack.slice() : [];
        return this;
      };
      Lexer.prototype.save = function() {
        return {
          line: this.line,
          col: this.col,
          state: this.state,
          stack: this.stack.slice(),
          queuedToken: this.queuedToken,
          queuedText: this.queuedText,
          queuedThrow: this.queuedThrow
        };
      };
      Lexer.prototype.setState = function(state) {
        if (!state || this.state === state) return;
        this.state = state;
        var info = this.states[state];
        this.groups = info.groups;
        this.error = info.error;
        this.re = info.regexp;
        this.fast = info.fast;
      };
      Lexer.prototype.popState = function() {
        this.setState(this.stack.pop());
      };
      Lexer.prototype.pushState = function(state) {
        this.stack.push(this.state);
        this.setState(state);
      };
      var eat = hasSticky ? function(re, buffer) {
        return re.exec(buffer);
      } : function(re, buffer) {
        var match = re.exec(buffer);
        if (match[0].length === 0) {
          return null;
        }
        return match;
      };
      Lexer.prototype._getGroup = function(match) {
        var groupCount = this.groups.length;
        for (var i = 0; i < groupCount; i++) {
          if (match[i + 1] !== void 0) {
            return this.groups[i];
          }
        }
        throw new Error("Cannot find token type for matched text");
      };
      function tokenToString() {
        return this.value;
      }
      Lexer.prototype.next = function() {
        var index = this.index;
        if (this.queuedGroup) {
          var token = this._token(this.queuedGroup, this.queuedText, index);
          this.queuedGroup = null;
          this.queuedText = "";
          return token;
        }
        var buffer = this.buffer;
        if (index === buffer.length) {
          return;
        }
        var group3 = this.fast[buffer.charCodeAt(index)];
        if (group3) {
          return this._token(group3, buffer.charAt(index), index);
        }
        var re = this.re;
        re.lastIndex = index;
        var match = eat(re, buffer);
        var error2 = this.error;
        if (match == null) {
          return this._token(error2, buffer.slice(index, buffer.length), index);
        }
        var group3 = this._getGroup(match);
        var text3 = match[0];
        if (error2.fallback && match.index !== index) {
          this.queuedGroup = group3;
          this.queuedText = text3;
          return this._token(error2, buffer.slice(index, match.index), index);
        }
        return this._token(group3, text3, index);
      };
      Lexer.prototype._token = function(group3, text3, offset) {
        var lineBreaks = 0;
        if (group3.lineBreaks) {
          var matchNL = /\n/g;
          var nl = 1;
          if (text3 === "\n") {
            lineBreaks = 1;
          } else {
            while (matchNL.exec(text3)) {
              lineBreaks++;
              nl = matchNL.lastIndex;
            }
          }
        }
        var token = {
          type: typeof group3.type === "function" && group3.type(text3) || group3.defaultType,
          value: typeof group3.value === "function" ? group3.value(text3) : text3,
          text: text3,
          toString: tokenToString,
          offset,
          lineBreaks,
          line: this.line,
          col: this.col
        };
        var size = text3.length;
        this.index += size;
        this.line += lineBreaks;
        if (lineBreaks !== 0) {
          this.col = size - nl + 1;
        } else {
          this.col += size;
        }
        if (group3.shouldThrow) {
          var err = new Error(this.formatError(token, "invalid syntax"));
          throw err;
        }
        if (group3.pop) this.popState();
        else if (group3.push) this.pushState(group3.push);
        else if (group3.next) this.setState(group3.next);
        return token;
      };
      if (typeof Symbol !== "undefined" && Symbol.iterator) {
        var LexerIterator = function(lexer) {
          this.lexer = lexer;
        };
        LexerIterator.prototype.next = function() {
          var token = this.lexer.next();
          return { value: token, done: !token };
        };
        LexerIterator.prototype[Symbol.iterator] = function() {
          return this;
        };
        Lexer.prototype[Symbol.iterator] = function() {
          return new LexerIterator(this);
        };
      }
      Lexer.prototype.formatError = function(token, message) {
        if (token == null) {
          var text3 = this.buffer.slice(this.index);
          var token = {
            text: text3,
            offset: this.index,
            lineBreaks: text3.indexOf("\n") === -1 ? 0 : 1,
            line: this.line,
            col: this.col
          };
        }
        var numLinesAround = 2;
        var firstDisplayedLine = Math.max(token.line - numLinesAround, 1);
        var lastDisplayedLine = token.line + numLinesAround;
        var lastLineDigits = String(lastDisplayedLine).length;
        var displayedLines = lastNLines(
          this.buffer,
          this.line - token.line + numLinesAround + 1
        ).slice(0, 5);
        var errorLines = [];
        errorLines.push(message + " at line " + token.line + " col " + token.col + ":");
        errorLines.push("");
        for (var i = 0; i < displayedLines.length; i++) {
          var line2 = displayedLines[i];
          var lineNo = firstDisplayedLine + i;
          errorLines.push(pad(String(lineNo), lastLineDigits) + "  " + line2);
          if (lineNo === token.line) {
            errorLines.push(pad("", lastLineDigits + token.col + 1) + "^");
          }
        }
        return errorLines.join("\n");
      };
      Lexer.prototype.clone = function() {
        return new Lexer(this.states, this.state);
      };
      Lexer.prototype.has = function(tokenType) {
        return true;
      };
      return {
        compile: compile2,
        states: compileStates,
        error: Object.freeze({ error: true }),
        fallback: Object.freeze({ fallback: true }),
        keywords: keywordTransform
      };
    });
  }
});

// ../dsm/node_modules/eastasianwidth/eastasianwidth.js
var require_eastasianwidth = __commonJS({
  "../dsm/node_modules/eastasianwidth/eastasianwidth.js"(exports, module) {
    var eaw = {};
    if ("undefined" == typeof module) {
      globalThis.eastasianwidth = eaw;
    } else {
      module.exports = eaw;
    }
    eaw.eastAsianWidth = function(character) {
      var x = character.charCodeAt(0);
      var y = character.length == 2 ? character.charCodeAt(1) : 0;
      var codePoint = x;
      if (55296 <= x && x <= 56319 && (56320 <= y && y <= 57343)) {
        x &= 1023;
        y &= 1023;
        codePoint = x << 10 | y;
        codePoint += 65536;
      }
      if (12288 == codePoint || 65281 <= codePoint && codePoint <= 65376 || 65504 <= codePoint && codePoint <= 65510) {
        return "F";
      }
      if (8361 == codePoint || 65377 <= codePoint && codePoint <= 65470 || 65474 <= codePoint && codePoint <= 65479 || 65482 <= codePoint && codePoint <= 65487 || 65490 <= codePoint && codePoint <= 65495 || 65498 <= codePoint && codePoint <= 65500 || 65512 <= codePoint && codePoint <= 65518) {
        return "H";
      }
      if (4352 <= codePoint && codePoint <= 4447 || 4515 <= codePoint && codePoint <= 4519 || 4602 <= codePoint && codePoint <= 4607 || 9001 <= codePoint && codePoint <= 9002 || 11904 <= codePoint && codePoint <= 11929 || 11931 <= codePoint && codePoint <= 12019 || 12032 <= codePoint && codePoint <= 12245 || 12272 <= codePoint && codePoint <= 12283 || 12289 <= codePoint && codePoint <= 12350 || 12353 <= codePoint && codePoint <= 12438 || 12441 <= codePoint && codePoint <= 12543 || 12549 <= codePoint && codePoint <= 12589 || 12593 <= codePoint && codePoint <= 12686 || 12688 <= codePoint && codePoint <= 12730 || 12736 <= codePoint && codePoint <= 12771 || 12784 <= codePoint && codePoint <= 12830 || 12832 <= codePoint && codePoint <= 12871 || 12880 <= codePoint && codePoint <= 13054 || 13056 <= codePoint && codePoint <= 19903 || 19968 <= codePoint && codePoint <= 42124 || 42128 <= codePoint && codePoint <= 42182 || 43360 <= codePoint && codePoint <= 43388 || 44032 <= codePoint && codePoint <= 55203 || 55216 <= codePoint && codePoint <= 55238 || 55243 <= codePoint && codePoint <= 55291 || 63744 <= codePoint && codePoint <= 64255 || 65040 <= codePoint && codePoint <= 65049 || 65072 <= codePoint && codePoint <= 65106 || 65108 <= codePoint && codePoint <= 65126 || 65128 <= codePoint && codePoint <= 65131 || 110592 <= codePoint && codePoint <= 110593 || 127488 <= codePoint && codePoint <= 127490 || 127504 <= codePoint && codePoint <= 127546 || 127552 <= codePoint && codePoint <= 127560 || 127568 <= codePoint && codePoint <= 127569 || 131072 <= codePoint && codePoint <= 194367 || 177984 <= codePoint && codePoint <= 196605 || 196608 <= codePoint && codePoint <= 262141) {
        return "W";
      }
      if (32 <= codePoint && codePoint <= 126 || 162 <= codePoint && codePoint <= 163 || 165 <= codePoint && codePoint <= 166 || 172 == codePoint || 175 == codePoint || 10214 <= codePoint && codePoint <= 10221 || 10629 <= codePoint && codePoint <= 10630) {
        return "Na";
      }
      if (161 == codePoint || 164 == codePoint || 167 <= codePoint && codePoint <= 168 || 170 == codePoint || 173 <= codePoint && codePoint <= 174 || 176 <= codePoint && codePoint <= 180 || 182 <= codePoint && codePoint <= 186 || 188 <= codePoint && codePoint <= 191 || 198 == codePoint || 208 == codePoint || 215 <= codePoint && codePoint <= 216 || 222 <= codePoint && codePoint <= 225 || 230 == codePoint || 232 <= codePoint && codePoint <= 234 || 236 <= codePoint && codePoint <= 237 || 240 == codePoint || 242 <= codePoint && codePoint <= 243 || 247 <= codePoint && codePoint <= 250 || 252 == codePoint || 254 == codePoint || 257 == codePoint || 273 == codePoint || 275 == codePoint || 283 == codePoint || 294 <= codePoint && codePoint <= 295 || 299 == codePoint || 305 <= codePoint && codePoint <= 307 || 312 == codePoint || 319 <= codePoint && codePoint <= 322 || 324 == codePoint || 328 <= codePoint && codePoint <= 331 || 333 == codePoint || 338 <= codePoint && codePoint <= 339 || 358 <= codePoint && codePoint <= 359 || 363 == codePoint || 462 == codePoint || 464 == codePoint || 466 == codePoint || 468 == codePoint || 470 == codePoint || 472 == codePoint || 474 == codePoint || 476 == codePoint || 593 == codePoint || 609 == codePoint || 708 == codePoint || 711 == codePoint || 713 <= codePoint && codePoint <= 715 || 717 == codePoint || 720 == codePoint || 728 <= codePoint && codePoint <= 731 || 733 == codePoint || 735 == codePoint || 768 <= codePoint && codePoint <= 879 || 913 <= codePoint && codePoint <= 929 || 931 <= codePoint && codePoint <= 937 || 945 <= codePoint && codePoint <= 961 || 963 <= codePoint && codePoint <= 969 || 1025 == codePoint || 1040 <= codePoint && codePoint <= 1103 || 1105 == codePoint || 8208 == codePoint || 8211 <= codePoint && codePoint <= 8214 || 8216 <= codePoint && codePoint <= 8217 || 8220 <= codePoint && codePoint <= 8221 || 8224 <= codePoint && codePoint <= 8226 || 8228 <= codePoint && codePoint <= 8231 || 8240 == codePoint || 8242 <= codePoint && codePoint <= 8243 || 8245 == codePoint || 8251 == codePoint || 8254 == codePoint || 8308 == codePoint || 8319 == codePoint || 8321 <= codePoint && codePoint <= 8324 || 8364 == codePoint || 8451 == codePoint || 8453 == codePoint || 8457 == codePoint || 8467 == codePoint || 8470 == codePoint || 8481 <= codePoint && codePoint <= 8482 || 8486 == codePoint || 8491 == codePoint || 8531 <= codePoint && codePoint <= 8532 || 8539 <= codePoint && codePoint <= 8542 || 8544 <= codePoint && codePoint <= 8555 || 8560 <= codePoint && codePoint <= 8569 || 8585 == codePoint || 8592 <= codePoint && codePoint <= 8601 || 8632 <= codePoint && codePoint <= 8633 || 8658 == codePoint || 8660 == codePoint || 8679 == codePoint || 8704 == codePoint || 8706 <= codePoint && codePoint <= 8707 || 8711 <= codePoint && codePoint <= 8712 || 8715 == codePoint || 8719 == codePoint || 8721 == codePoint || 8725 == codePoint || 8730 == codePoint || 8733 <= codePoint && codePoint <= 8736 || 8739 == codePoint || 8741 == codePoint || 8743 <= codePoint && codePoint <= 8748 || 8750 == codePoint || 8756 <= codePoint && codePoint <= 8759 || 8764 <= codePoint && codePoint <= 8765 || 8776 == codePoint || 8780 == codePoint || 8786 == codePoint || 8800 <= codePoint && codePoint <= 8801 || 8804 <= codePoint && codePoint <= 8807 || 8810 <= codePoint && codePoint <= 8811 || 8814 <= codePoint && codePoint <= 8815 || 8834 <= codePoint && codePoint <= 8835 || 8838 <= codePoint && codePoint <= 8839 || 8853 == codePoint || 8857 == codePoint || 8869 == codePoint || 8895 == codePoint || 8978 == codePoint || 9312 <= codePoint && codePoint <= 9449 || 9451 <= codePoint && codePoint <= 9547 || 9552 <= codePoint && codePoint <= 9587 || 9600 <= codePoint && codePoint <= 9615 || 9618 <= codePoint && codePoint <= 9621 || 9632 <= codePoint && codePoint <= 9633 || 9635 <= codePoint && codePoint <= 9641 || 9650 <= codePoint && codePoint <= 9651 || 9654 <= codePoint && codePoint <= 9655 || 9660 <= codePoint && codePoint <= 9661 || 9664 <= codePoint && codePoint <= 9665 || 9670 <= codePoint && codePoint <= 9672 || 9675 == codePoint || 9678 <= codePoint && codePoint <= 9681 || 9698 <= codePoint && codePoint <= 9701 || 9711 == codePoint || 9733 <= codePoint && codePoint <= 9734 || 9737 == codePoint || 9742 <= codePoint && codePoint <= 9743 || 9748 <= codePoint && codePoint <= 9749 || 9756 == codePoint || 9758 == codePoint || 9792 == codePoint || 9794 == codePoint || 9824 <= codePoint && codePoint <= 9825 || 9827 <= codePoint && codePoint <= 9829 || 9831 <= codePoint && codePoint <= 9834 || 9836 <= codePoint && codePoint <= 9837 || 9839 == codePoint || 9886 <= codePoint && codePoint <= 9887 || 9918 <= codePoint && codePoint <= 9919 || 9924 <= codePoint && codePoint <= 9933 || 9935 <= codePoint && codePoint <= 9953 || 9955 == codePoint || 9960 <= codePoint && codePoint <= 9983 || 10045 == codePoint || 10071 == codePoint || 10102 <= codePoint && codePoint <= 10111 || 11093 <= codePoint && codePoint <= 11097 || 12872 <= codePoint && codePoint <= 12879 || 57344 <= codePoint && codePoint <= 63743 || 65024 <= codePoint && codePoint <= 65039 || 65533 == codePoint || 127232 <= codePoint && codePoint <= 127242 || 127248 <= codePoint && codePoint <= 127277 || 127280 <= codePoint && codePoint <= 127337 || 127344 <= codePoint && codePoint <= 127386 || 917760 <= codePoint && codePoint <= 917999 || 983040 <= codePoint && codePoint <= 1048573 || 1048576 <= codePoint && codePoint <= 1114109) {
        return "A";
      }
      return "N";
    };
    eaw.characterLength = function(character) {
      var code = this.eastAsianWidth(character);
      if (code == "F" || code == "W" || code == "A") {
        return 2;
      } else {
        return 1;
      }
    };
    function stringToArray(string) {
      return string.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\uD800-\uDFFF]/g) || [];
    }
    eaw.length = function(string) {
      var characters = stringToArray(string);
      var len = 0;
      for (var i = 0; i < characters.length; i++) {
        len = len + this.characterLength(characters[i]);
      }
      return len;
    };
    eaw.slice = function(text3, start, end) {
      textLen = eaw.length(text3);
      start = start ? start : 0;
      end = end ? end : 1;
      if (start < 0) {
        start = textLen + start;
      }
      if (end < 0) {
        end = textLen + end;
      }
      var result = "";
      var eawLen = 0;
      var chars = stringToArray(text3);
      for (var i = 0; i < chars.length; i++) {
        var char = chars[i];
        var charLen = eaw.length(char);
        if (eawLen >= start - (charLen == 2 ? 1 : 0)) {
          if (eawLen + charLen <= end) {
            result += char;
          } else {
            break;
          }
        }
        eawLen += charLen;
      }
      return result;
    };
  }
});

// ../dsm/node_modules/emoji-regex/index.js
var require_emoji_regex = __commonJS({
  "../dsm/node_modules/emoji-regex/index.js"(exports, module) {
    "use strict";
    module.exports = function() {
      return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67)\uDB40\uDC7F|(?:\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFC-\uDFFF])|\uD83D\uDC68(?:\uD83C\uDFFB(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF]))|\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|[\u2695\u2696\u2708]\uFE0F|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))?|(?:\uD83C[\uDFFC-\uDFFF])\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF]))|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])\uFE0F|\u200D(?:(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D[\uDC66\uDC67])|\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC)?|(?:\uD83D\uDC69(?:\uD83C\uDFFB\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|(?:\uD83C[\uDFFC-\uDFFF])\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69]))|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC69(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83E\uDDD1(?:\u200D(?:\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|\uD83D\uDE36\u200D\uD83C\uDF2B|\uD83C\uDFF3\uFE0F\u200D\u26A7|\uD83D\uDC3B\u200D\u2744|(?:(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\uD83C\uDFF4\u200D\u2620|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])\u200D[\u2640\u2642]|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u2600-\u2604\u260E\u2611\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26B0\u26B1\u26C8\u26CF\u26D1\u26D3\u26E9\u26F0\u26F1\u26F4\u26F7\u26F8\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u3030\u303D\u3297\u3299]|\uD83C[\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]|\uD83D[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3])\uFE0F|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDE35\u200D\uD83D\uDCAB|\uD83D\uDE2E\u200D\uD83D\uDCA8|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83E\uDDD1(?:\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC|\uD83C\uDFFB)?|\uD83D\uDC69(?:\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC|\uD83C\uDFFB)?|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF6\uD83C\uDDE6|\uD83C\uDDF4\uD83C\uDDF2|\uD83D\uDC08\u200D\u2B1B|\u2764\uFE0F\u200D(?:\uD83D\uDD25|\uD83E\uDE79)|\uD83D\uDC41\uFE0F|\uD83C\uDFF3\uFE0F|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|[#\*0-9]\uFE0F\u20E3|\u2764\uFE0F|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])|\uD83C\uDFF4|(?:[\u270A\u270B]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270C\u270D]|\uD83D[\uDD74\uDD90])(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])|[\u270A\u270B]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC08\uDC15\uDC3B\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE2E\uDE35\uDE36\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5]|\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD]|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF]|[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0D\uDD0E\uDD10-\uDD17\uDD1D\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78\uDD7A-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCB\uDDD0\uDDE0-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6]|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5-\uDED7\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0C-\uDD3A\uDD3C-\uDD45\uDD47-\uDD78\uDD7A-\uDDCB\uDDCD-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26A7\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5-\uDED7\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0C-\uDD3A\uDD3C-\uDD45\uDD47-\uDD78\uDD7A-\uDDCB\uDDCD-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDD77\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
    };
  }
});

// ../dsm/text-mode-core/TextAST/index.ts
var TextAST_exports = {};
__export(TextAST_exports, {
  NodePath: () => NodePath,
  isExpression: () => isExpression,
  isStatement: () => isStatement
});
function isExpression(n) {
  if (isStatement(n)) return false;
  switch (n.type) {
    case "Program":
    case "RegressionParameters":
    case "RegressionEntry":
    case "StyleMapping":
    case "MappingEntry":
    case "AssignmentExpression":
    case "PiecewiseBranch":
      n;
      return false;
    default:
      n;
      return true;
  }
}
function isStatement(n) {
  switch (n.type) {
    case "ExprStatement":
    case "Table":
    case "Image":
    case "Text":
    case "Folder":
    case "Settings":
    case "Ticker":
      n;
      return true;
    default:
      n;
      return false;
  }
}
var NodePath = class _NodePath {
  constructor(node, parentPath, name) {
    this.node = node;
    this.parentPath = parentPath;
    this.name = name;
  }
  get parent() {
    return this.parentPath ? this.parentPath.node : null;
  }
  withChild(node, name) {
    return new _NodePath(node, this, name);
  }
};

// ../dsm/text-mode-core/TextAST/Synthetic.ts
var Synthetic_exports = {};
__export(Synthetic_exports, {
  NodePath: () => NodePath2,
  number: () => number
});
var NodePath2 = class extends TextAST_exports.NodePath {
};
function number(val) {
  return {
    type: "Number",
    value: val
  };
}

// ../dsm/text-mode-core/aug/AugState.ts
var AugState_exports = {};
__export(AugState_exports, {
  Latex: () => AugLatex_exports
});

// ../dsm/text-mode-core/aug/AugLatex.ts
var AugLatex_exports = {};
__export(AugLatex_exports, {
  constant: () => constant,
  isConstant: () => isConstant,
  isPiecewiseBoolean: () => isPiecewiseBoolean,
  isRestrictionBoolean: () => isRestrictionBoolean
});
function isPiecewiseBoolean(arg) {
  return arg.type === "Comparator" || arg.type === "ComparatorChain";
}
function isRestrictionBoolean(arg) {
  return isPiecewiseBoolean(arg) || arg.type === "Or";
}
function isConstant(e, v) {
  return e && e.type === "Constant" && (e.value === v || isNaN(e.value) && isNaN(v));
}
function constant(value) {
  return { type: "Constant", value };
}

// ../dsm/text-mode-core/aug/augNeedsParens.ts
function augNeedsParens(node, parent, path) {
  if (node.type === "Seq" && node.parenWrapped) return true;
  const nodeIsLikeSub = node.type === "Substitution";
  if (path === "before-comma" && nodeIsLikeSub) return true;
  if (parent === null) return false;
  switch (parent.type) {
    case "Integral":
      return path === "integrand" && power(node) <= POWERS.add;
    case "ListAccess":
      return path === "list" && power(node) < POWERS.power;
    case "DotAccess":
    case "OrderedPairAccess":
      return path === "object" && power(node) < POWERS.power;
    case "RepeatedOperator":
      return path === "term" && power(node) <= POWERS.add;
    case "Derivative":
      return power(node) <= POWERS.add;
    case "Comparator":
    case "ComparatorChain":
      return power(node) <= (path === "top-level-eq" ? POWERS.top : POWERS.compare);
    case "BinaryOperator":
      return binopNeedsParens(node, parent.name, path);
    case "Negative":
    case "Positive":
      if (node.type === "Constant" && node.value > 0) return false;
      return power(node) <= POWERS.prefix;
    case "Factorial":
      return power(node) < POWERS.power;
    case "AssignmentExpression":
      return nodeIsLikeSub;
    case "ListComprehension":
    case "Substitution":
    case "UpdateRule":
      return power(node) <= POWERS.update;
    // List of things, including function args
    case "FunctionCall":
    case "Seq":
    case "Prime":
    case "Visualization":
    case "List":
    case "Piecewise":
    case "Restriction":
    case "Or":
    // Note "Or" can only show up as a direct child of restriction or Or.
    case "Range":
    case "Norm":
      return false;
    // Top-level cases
    case "Equation":
    case "FunctionDefinition":
    case "Regression":
    case "Assignment":
      return false;
    default:
      parent.type;
      return true;
  }
}
var _precedence = [
  "top",
  "seq",
  "update",
  "with",
  "compare",
  "add",
  "multiply",
  "prefix",
  "power",
  "factorial",
  "index",
  "call",
  "atom"
];
var _precIndices = _precedence.map((op, index) => [op, index * 10]);
var POWERS = Object.fromEntries(_precIndices);
function binopNeedsParens(node, parentName, path) {
  const parentPower = path === "left" ? binopLeftPower(parentName) : binopRightPower(parentName);
  if (node.type === "BinaryOperator") {
    if (node.name === "CrossMultiply" && parentName === "Multiply" || // For clarity, always parenthesize multiplication in cross product or vice versa etc.
    node.name === "Multiply" && parentName === "CrossMultiply")
      return true;
  }
  return power(node) <= parentPower;
}
function binopLeftPower(name) {
  return name === "Divide" ? POWERS.top - 1 : name === "Exponent" ? POWERS.power + 1 : binopPower(name) - 1;
}
function binopRightPower(name) {
  return name === "Divide" || name === "Exponent" ? POWERS.top - 1 : binopPower(name);
}
function binopPower(name) {
  switch (name) {
    case "Exponent":
      return POWERS.power;
    case "Multiply":
    case "CrossMultiply":
      return POWERS.multiply;
    case "Divide":
      return POWERS.atom;
    case "Add":
    case "Subtract":
      return POWERS.add;
    default:
      name;
      return POWERS.top;
  }
}
function power(node) {
  switch (node.type) {
    case "Constant":
      return node.value < 0 ? POWERS.prefix : POWERS.atom;
    case "Identifier":
    case "List":
    case "Range":
    case "Piecewise":
    case "Restriction":
      return POWERS.atom;
    case "ListComprehension":
      return node.bracketWrapped ? POWERS.atom : POWERS.with;
    case "Factorial":
      return POWERS.factorial;
    case "FunctionCall":
    case "Prime":
    case "Norm":
      return POWERS.call;
    case "ListAccess":
    case "DotAccess":
    case "OrderedPairAccess":
      return POWERS.index;
    case "Negative":
    case "Positive":
      return POWERS.prefix;
    case "BinaryOperator":
      return binopPower(node.name);
    case "Integral":
    case "Derivative":
    case "RepeatedOperator":
      return POWERS.multiply;
    case "UpdateRule":
      return POWERS.update;
    case "Comparator":
    case "ComparatorChain":
    case "AssignmentExpression":
      return POWERS.compare;
    case "Or":
    case "Seq":
      return POWERS.seq;
    case "Substitution":
      return POWERS.with;
    default:
      node;
      return POWERS.top;
  }
}

// ../dsm/text-mode-core/aug/augLatexToRaw.ts
function latexTreeToString(cfg, e) {
  switch (e.type) {
    case "Equation":
    case "Assignment":
      return childNodeToString(cfg, e.left, e) + "=" + childNodeToString(cfg, e.right, e, "top-level-eq");
    case "FunctionDefinition":
      return funcToString(cfg, e.symbol, e.argSymbols, e) + "=" + childNodeToString(cfg, e.definition, e, "top-level-eq");
    case "Visualization":
      return funcToString(cfg, e.callee, e.args, e);
    case "Regression":
      return childNodeToString(cfg, e.left, e) + "\\sim " + childNodeToString(cfg, e.right, e);
    default:
      return childNodeToString(cfg, e, null, "top");
  }
}
function childNodeToString(cfg, e, parent, path) {
  const inner = childNodeToStringNoParen(cfg, e, path);
  if (augNeedsParens(e, parent, path)) return wrapParen(inner);
  return inner;
}
function childNodeToStringNoParen(cfg, e, path) {
  switch (e.type) {
    case "Constant": {
      const res = e.value.toString();
      return res.includes("e") ? "(" + res.replace("e", "*10^{") + "})" : res;
    }
    case "Identifier":
      return identifierToString(cfg, e);
    case "FunctionCall":
      return funcToString(cfg, e.callee, e.args, e);
    case "Integral":
      return `\\int_{${childNodeToString(cfg, e.start, e)}}^{${childNodeToString(cfg, e.end, e)}}` + childNodeToString(cfg, e.integrand, e, "integrand") + "d" + identifierToString(cfg, e.differential);
    case "Derivative":
      return `\\frac{d}{d${identifierToString(cfg, e.variable)}}` + childNodeToString(cfg, e.arg, e);
    case "Prime":
      return identifierToString(cfg, e.arg.callee) + "'".repeat(e.order) + wrapParen(bareSeq(cfg, e.arg.args, e.arg));
    case "List":
      return wrapBracket(bareSeq(cfg, e.args, e));
    case "Range":
      return wrapBracket(
        bareSeq(cfg, e.start, e, { alwaysBeforeComma: true }) + "..." + bareSeq(cfg, e.end, e)
      );
    case "ListAccess":
      return childNodeToString(cfg, e.list, e, "list") + (e.index.type === "Range" || e.index.type === "List" ? childNodeToString(cfg, e.index, e) : wrapBracket(childNodeToString(cfg, e.index, e)));
    case "DotAccess":
      return childNodeToString(cfg, e.object, e, "object") + "." + childNodeToString(cfg, e.property, e);
    case "OrderedPairAccess":
      return childNodeToString(cfg, e.point, e, "object") + "." + e.index;
    case "Seq":
      return bareSeq(cfg, e.args, e);
    case "UpdateRule":
      return identifierToString(cfg, e.variable) + "\\to " + childNodeToString(cfg, e.expression, e);
    case "ListComprehension": {
      const assignments = e.assignments.map(
        (f) => childNodeToString(cfg, f, e)
      );
      const parameters = e.parameters.map(
        ({ identifier, open, bounds: [min, max] }) => childNodeToString(cfg, min, e) + (open[0] ? "<" : "\\le ") + childNodeToString(cfg, identifier, e) + (open[1] ? "<" : "\\le ") + childNodeToString(cfg, max, e)
      );
      if (assignments.length + parameters.length === 0) {
        throw new Error("Programming error: empty 'for' RHS.");
      }
      const unwrapped = childNodeToString(cfg, e.expr, e) + "\\operatorname{for}" + [...parameters, ...assignments].join(",");
      return e.bracketWrapped ? wrapBracket(unwrapped) : unwrapped;
    }
    case "Substitution":
      return childNodeToString(cfg, e.body, e) + "\\operatorname{with}" + bareSeq(cfg, e.assignments, e);
    case "Piecewise": {
      const piecewiseParts = [];
      let curr = e;
      while (curr.type === "Piecewise") {
        if (curr.condition === true) {
          curr = curr.consequent;
          break;
        }
        let part = childNodeToString(cfg, curr.condition, curr);
        if (!AugState_exports.Latex.isConstant(curr.consequent, 1)) {
          part += ":" + childNodeToString(
            cfg,
            curr.consequent,
            curr,
            beforeComma(
              curr.alternate.type === "Piecewise" || !AugState_exports.Latex.isConstant(curr.alternate, NaN)
            )
          );
        }
        piecewiseParts.push(part);
        curr = curr.alternate;
      }
      if (!AugState_exports.Latex.isConstant(curr, NaN)) {
        if (piecewiseParts.length === 0) {
          if (!AugState_exports.Latex.isConstant(curr, 1))
            throw new Error(
              "Programming error: first branch in Aug piecewise is unconditional but not 1."
            );
        } else piecewiseParts.push(childNodeToString(cfg, curr, e));
      }
      return "\\left\\{" + piecewiseParts.join(",") + "\\right\\}";
    }
    case "Restriction": {
      if (e.condition === true) return "\\left\\{\\right\\}";
      return "\\left\\{" + childNodeToString(cfg, e.condition, e) + "\\right\\}";
    }
    case "Or":
      return childNodeToString(cfg, e.left, e) + "," + childNodeToString(cfg, e.right, e);
    case "RepeatedOperator": {
      const prefix = e.name === "Product" ? "\\prod" : "\\sum";
      return prefix + `_{${identifierToString(cfg, e.index)}=${childNodeToString(
        cfg,
        e.start,
        e
      )}}^{${childNodeToString(cfg, e.end, e)}}` + childNodeToString(cfg, e.expression, e, "term");
    }
    case "BinaryOperator": {
      const binopLeft = childNodeToString(cfg, e.left, e, "left");
      const binopRight = childNodeToString(cfg, e.right, e, "right");
      switch (e.name) {
        case "Add":
          return binopLeft + "+" + binopRight;
        case "Subtract":
          return binopLeft + "-" + binopRight;
        case "Multiply":
          return binopLeft + "\\cdot " + binopRight;
        case "CrossMultiply":
          return binopLeft + "\\times " + binopRight;
        case "Divide":
          return `\\frac{${binopLeft}}{${binopRight}}`;
        case "Exponent":
          return binopLeft + "^{" + binopRight + "}";
        default:
          e;
          throw new Error(`Unexpected BinaryOperator ${e.name}`);
      }
    }
    case "Negative":
      return "-" + childNodeToString(cfg, e.arg, e);
    case "Positive":
      return "+" + childNodeToString(cfg, e.arg, e);
    case "Norm":
      return "\\left|" + childNodeToString(cfg, e.arg, e) + "\\right|";
    case "Factorial":
      return childNodeToString(cfg, e.arg, e, "factorial") + "!";
    case "Comparator":
      return childNodeToString(cfg, e.left, e) + comparatorMap[e.operator] + childNodeToString(
        cfg,
        e.right,
        e,
        path === "top" && e.operator === "=" ? "top-level-eq" : void 0
      );
    case "ComparatorChain": {
      let s = "";
      for (let i = 0; i < e.args.length; i++) {
        s += childNodeToString(cfg, e.args[i], e);
        if (i < e.symbols.length) {
          s += comparatorMap[e.symbols[i]];
        }
      }
      return s;
    }
    case "AssignmentExpression":
      return identifierToString(cfg, e.variable) + "=" + childNodeToString(cfg, e.expression, e);
    default:
      e;
      throw new Error(
        `Programming Error: Unexpected Aug node ${e.type}`
      );
  }
}
var comparatorMap = {
  "<": "<",
  "<=": "\\le ",
  "=": "=",
  ">=": "\\ge ",
  ">": ">"
};
function bareSeq(cfg, e, parent, { alwaysBeforeComma } = { alwaysBeforeComma: false }) {
  return e.map(
    (f, i) => childNodeToString(
      cfg,
      f,
      parent,
      beforeComma(alwaysBeforeComma || i < e.length - 1)
    )
  ).join(",");
}
function beforeComma(beforeComma2) {
  return beforeComma2 ? "before-comma" : "last-element";
}
function funcToString(cfg, callee, args, parent) {
  if (callee.symbol === "sqrt" && args.length === 1) {
    return `\\sqrt{${bareSeq(cfg, args, parent)}}`;
  } else if (callee.symbol === "nthroot" && [1, 2].includes(args.length)) {
    if (args.length === 1) return `\\sqrt{${bareSeq(cfg, args, parent)}}`;
    return `\\sqrt[${childNodeToString(cfg, args[1], parent)}]{${bareSeq(
      cfg,
      [...args.slice(0, 1), ...args.slice(2)],
      parent
    )}}`;
  } else if (callee.symbol === "logbase" && args.length === 2) {
    return `\\log_{${childNodeToString(cfg, args[args.length - 1], parent)}}` + wrapParen(bareSeq(cfg, args.slice(0, args.length - 1), parent));
  } else {
    return identifierToString(cfg, callee) + wrapParen(bareSeq(cfg, args, parent));
  }
}
function identifierToString(cfg, id2) {
  const tokenMatch = /^\$(\d+)$/.exec(id2.symbol);
  if (tokenMatch) return `\\token{${tokenMatch[1]}}`;
  const symbol = id2.symbol.replace(/[{}]/g, "");
  let main = symbol;
  let subscript;
  const uIndex = symbol.indexOf("_");
  if (uIndex >= 0) {
    main = symbol.substring(0, uIndex);
    subscript = symbol.substring(uIndex + 1);
    if (!/^[a-zA-Z]+$/.test(main) || !/^[a-zA-Z0-9]+$/.test(subscript)) {
      throw new Error(`Unexpected character in ${symbol}`);
    }
  }
  const start = main.length === 1 ? main : cfg.commandNames.has(main) ? "\\" + main : `\\operatorname{${main}}`;
  const end = subscript ? `_{${subscript}}` : "";
  return start + end;
}
function wrapParen(s) {
  return "\\left(" + s + "\\right)";
}
function wrapBracket(s) {
  return "\\left[" + s + "\\right]";
}

// ../dsm/metadata/manage.ts
var ID_METADATA = "dsm-metadata";
var ID_METADATA_FOLDER = "dsm-metadata-folder";
function getBlankMetadata() {
  return {
    version: 2,
    expressions: {}
  };
}
function isBlankMetadata(metadata) {
  return Object.keys(metadata.expressions).length === 0 && Object.keys(metadata).length === 2;
}
function changeExprInMetadata(metadata, id2, obj) {
  const changed = metadata.expressions[id2] ?? {};
  for (const _key in obj) {
    const key = _key;
    const value = obj[key];
    if (value !== getDefaultValue(key)) {
      changed[key] = value;
    } else {
      delete changed[key];
    }
  }
  if (Object.keys(changed).length === 0) {
    delete metadata.expressions[id2];
  } else {
    metadata.expressions[id2] = changed;
  }
}
function getDefaultValue(key) {
  switch (key) {
    case "pinned":
    case "errorHidden":
    case "glesmos":
    case "glesmosLinesConfirmed":
      return false;
    default: {
      const _exhaustive = key;
      return _exhaustive;
    }
  }
}

// ../dsm/text-mode-core/aug/augToRaw.ts
function augToRaw(cfg, aug) {
  const list = [];
  const dsmMetadata = {
    version: 2,
    expressions: {}
  };
  for (const expr of aug.expressions.list) {
    updateDsmMetadata(dsmMetadata, expr);
    if (expr.type === "folder") {
      list.push(augFolderToRaw(expr));
      for (const child of expr.children) {
        updateDsmMetadata(dsmMetadata, child);
        list.push({
          ...augNonFolderToRaw(cfg, child),
          folderId: expr.id
        });
      }
    } else {
      list.push(augNonFolderToRaw(cfg, expr));
    }
  }
  if (!isBlankMetadata(dsmMetadata)) {
    list.push(
      {
        type: "folder",
        id: ID_METADATA_FOLDER,
        secret: true,
        title: "DesModder Metadata"
      },
      {
        type: "text",
        id: ID_METADATA,
        folderId: ID_METADATA_FOLDER,
        text: JSON.stringify(dsmMetadata)
      }
    );
  }
  const { randomSeed } = aug.settings;
  delete aug.settings.randomSeed;
  const res = {
    // TODO-graph-state: version 11? Not sure if it changes any behavior (due to migrations).
    version: 9,
    randomSeed,
    graph: {
      ...aug.settings,
      threeDMode: aug.settings.product === "graphing-3d"
    },
    expressions: {
      list,
      ticker: aug.expressions.ticker && augTickerToRaw(cfg, aug.expressions.ticker)
    }
  };
  cleanUndefined(res);
  return res;
}
function cleanUndefined(obj) {
  if (typeof obj === "object") {
    for (const key in obj) {
      if (key in obj && obj[key] === void 0) {
        delete obj[key];
      } else {
        cleanUndefined(obj[key]);
      }
    }
  }
}
function augTickerToRaw(cfg, ticker3) {
  return {
    handlerLatex: latexTreeToString(cfg, ticker3.handlerLatex),
    minStepLatex: latexTreeToString(cfg, ticker3.minStepLatex),
    playing: ticker3.playing,
    open: true
  };
}
function updateDsmMetadata(dsmMetadata, expr) {
  if (expr.type !== "folder" && expr.pinned) {
    changeExprInMetadata(dsmMetadata, expr.id, { pinned: true });
  }
  if (expr.type === "expression") {
    if (expr.errorHidden) {
      changeExprInMetadata(dsmMetadata, expr.id, { errorHidden: true });
    }
    if (expr.glesmos) {
      changeExprInMetadata(dsmMetadata, expr.id, { glesmos: true });
    }
  }
}
function augFolderToRaw(expr) {
  return {
    id: expr.id,
    secret: expr.secret,
    type: "folder",
    hidden: expr.hidden,
    collapsed: expr.collapsed,
    title: expr.title
  };
}
function augNonFolderToRaw(cfg, item) {
  const base2 = {
    id: item.id,
    secret: item.secret
  };
  switch (item.type) {
    case "expression": {
      const shouldFill = item.fillOpacity ? !AugState_exports.Latex.isConstant(item.fillOpacity, 0) : void 0;
      return {
        ...base2,
        type: "expression",
        ...columnExpressionCommon(cfg, item),
        fill: shouldFill,
        fillOpacity: shouldFill ? latexTreeToStringMaybe(cfg, item.fillOpacity) : void 0,
        residualVariable: latexTreeToStringMaybe(
          cfg,
          item.regression?.residualVariable
        ),
        regressionParameters: Object.fromEntries(
          [...item.regression?.regressionParameters.entries() ?? []].map(
            ([k, v]) => [latexTreeToString(cfg, k), v]
          )
        ),
        isLogModeRegression: item.regression?.isLogMode,
        ...item.label ? {
          label: item.label.text,
          showLabel: true,
          labelSize: latexTreeToString(cfg, item.label.size),
          labelOrientation: item.label.orientation,
          labelAngle: latexTreeToString(cfg, item.label.angle),
          suppressTextOutline: !item.label.outline,
          interactiveLabel: item.label.showOnHover,
          editableLabelMode: item.label.editableMode === "NONE" ? void 0 : item.label.editableMode
        } : {},
        slider: {
          animationPeriod: item.slider.period,
          loopMode: item.slider.loopMode,
          playDirection: item.slider.playDirection,
          isPlaying: item.slider.isPlaying,
          hardMin: !!item.slider.min && item.slider.loopMode !== "PLAY_INDEFINITELY",
          min: latexTreeToStringMaybe(cfg, item.slider.min),
          hardMax: !!item.slider.max && item.slider.loopMode !== "PLAY_INDEFINITELY",
          max: latexTreeToStringMaybe(cfg, item.slider.max),
          step: latexTreeToStringMaybe(cfg, item.slider.step)
        },
        displayEvaluationAsFraction: item.fractionDisplay,
        polarDomain: item.polarDomain && latexMapDomain(cfg, item.polarDomain),
        parametricDomain: item.parametricDomain && latexMapDomain(cfg, item.parametricDomain),
        parametricDomain3Du: item.parametricDomain3Du && latexMapDomain(cfg, item.parametricDomain3Du),
        parametricDomain3Dv: item.parametricDomain3Dv && latexMapDomain(cfg, item.parametricDomain3Dv),
        parametricDomain3Dr: item.parametricDomain3Dr && latexMapDomain(cfg, item.parametricDomain3Dr),
        parametricDomain3Dphi: item.parametricDomain3Dphi && latexMapDomain(cfg, item.parametricDomain3Dphi),
        domain: item.parametricDomain && latexMapDomain(cfg, item.parametricDomain),
        cdf: item.cdf && {
          show: true,
          min: latexTreeToStringMaybe(cfg, item.cdf.min),
          max: latexTreeToStringMaybe(cfg, item.cdf.max)
        },
        vizProps: {
          breadth: latexTreeToStringMaybe(cfg, item.vizProps.boxplot?.breadth),
          axisOffset: latexTreeToStringMaybe(
            cfg,
            item.vizProps.boxplot?.axisOffset
          ),
          alignedAxis: item.vizProps.boxplot?.alignedAxis,
          showBoxplotOutliers: item.vizProps.boxplot?.showOutliers,
          dotplotXMode: item.vizProps.dotplotMode,
          binAlignment: item.vizProps.binAlignment,
          histogramMode: item.vizProps.histogramMode
        },
        clickableInfo: item.clickableInfo && {
          enabled: true,
          description: item.clickableInfo.description,
          latex: latexTreeToString(cfg, item.clickableInfo.latex)
        }
      };
    }
    case "image":
      return {
        ...base2,
        type: "image",
        image_url: item.image_url,
        name: item.name,
        width: latexTreeToString(cfg, item.width),
        height: latexTreeToString(cfg, item.height),
        hidden: AugState_exports.Latex.isConstant(item.opacity, 0),
        center: latexTreeToString(cfg, item.center),
        angle: latexTreeToString(cfg, item.angle),
        opacity: latexTreeToString(cfg, item.opacity),
        foreground: item.foreground,
        draggable: item.draggable,
        clickableInfo: item.clickableInfo && {
          enabled: true,
          description: item.clickableInfo.description,
          latex: latexTreeToString(cfg, item.clickableInfo.latex),
          hoveredImage: item.clickableInfo.hoveredImage,
          depressedImage: item.clickableInfo.depressedImage
        }
      };
    case "table":
      return {
        ...base2,
        type: "table",
        columns: item.columns.map((column3) => ({
          values: (
            // Desmos expects at least one row
            column3.values.length > 0 ? column3.values.map((e) => columnEntryToString(cfg, e)) : [""]
          ),
          id: column3.id,
          ...columnExpressionCommon(cfg, column3)
        })).concat(
          Array.from({ length: 2 - item.columns.length }).map(() => ({
            id: "dsm-blank-" + Math.random().toString().slice(2, 16),
            values: [""],
            color: "#2D70B3"
          }))
        )
      };
    case "text":
      return {
        ...base2,
        type: "text",
        text: item.text ?? ""
      };
  }
}
function latexMapDomain(cfg, domain2) {
  if (!domain2) {
    return void 0;
  } else {
    return {
      min: domain2.min ? latexTreeToString(cfg, domain2.min) : "",
      max: domain2.max ? latexTreeToString(cfg, domain2.max) : ""
    };
  }
}
function columnExpressionCommon(cfg, item) {
  const res = {
    color: "",
    hidden: item.hidden,
    latex: latexTreeToStringMaybe(cfg, item.latex)
  };
  if (typeof item.color === "string") {
    res.color = item.color;
  } else {
    res.color = "#c74440";
    res.colorLatex = latexTreeToString(cfg, item.color);
  }
  if (item.points) {
    res.points = !isConstant(item.points.opacity, 0) && !isConstant(item.points.size, 0);
    if (item.points.opacity)
      res.pointOpacity = latexTreeToString(cfg, item.points.opacity);
    if (item.points.size)
      res.pointSize = latexTreeToString(cfg, item.points.size);
    res.pointStyle = item.points.style;
    res.dragMode = item.points.dragMode;
  }
  if (item.lines) {
    res.lines = !isConstant(item.lines.opacity, 0) && !isConstant(item.lines.width, 0);
    if (item.lines.opacity)
      res.lineOpacity = latexTreeToString(cfg, item.lines.opacity);
    if (item.lines.width)
      res.lineWidth = latexTreeToString(cfg, item.lines.width);
    res.lineStyle = item.lines.style;
  }
  return res;
}
function latexTreeToStringMaybe(cfg, e) {
  if (!e) return void 0;
  return latexTreeToString(cfg, e);
}
function columnEntryToString(cfg, e) {
  if (e.type === "Identifier" && e.symbol === "N_aN") return "";
  return latexTreeToString(cfg, e);
}

// ../dsm/text-mode-core/up/augToAST.ts
function augToTextAST(aug) {
  const stmts = [graphSettingsToAST(aug.settings)];
  if (aug.expressions.ticker) {
    stmts.push(tickerToAST(aug.expressions.ticker));
  }
  for (const expr of aug.expressions.list) {
    const item = itemAugToAST(expr);
    if (item) stmts.push(item);
  }
  return {
    type: "Program",
    children: stmts
  };
}
function graphSettingsToAST(settings3) {
  return {
    type: "Settings",
    style: styleMapping({
      product: stringToASTmaybe(settings3.product),
      randomSeed: stringToASTmaybe(settings3.randomSeed),
      viewport: styleMapping({
        xmin: numberToASTmaybe(settings3.viewport.xmin),
        xmax: numberToASTmaybe(settings3.viewport.xmax),
        ymin: numberToASTmaybe(settings3.viewport.ymin),
        ymax: numberToASTmaybe(settings3.viewport.ymax),
        zmin: numberToASTmaybe(settings3.viewport.zmin),
        zmax: numberToASTmaybe(settings3.viewport.zmax)
      }),
      xAxisMinorSubdivisions: numberToASTmaybe(settings3.xAxisMinorSubdivisions),
      yAxisMinorSubdivisions: numberToASTmaybe(settings3.yAxisMinorSubdivisions),
      degreeMode: booleanToAST(settings3.degreeMode, false),
      complex: booleanToAST(settings3.complex, false),
      showGrid: booleanToAST(settings3.showGrid, true),
      showXAxis: booleanToAST(settings3.showXAxis, true),
      showYAxis: booleanToAST(settings3.showYAxis, true),
      xAxisNumbers: booleanToAST(settings3.xAxisNumbers, true),
      yAxisNumbers: booleanToAST(settings3.yAxisNumbers, true),
      polarNumbers: booleanToAST(settings3.polarNumbers, true),
      xAxisStep: numberToASTmaybe(settings3.xAxisStep),
      yAxisStep: numberToASTmaybe(settings3.yAxisStep),
      xAxisArrowMode: stringToASTmaybe(settings3.xAxisArrowMode),
      yAxisArrowMode: stringToASTmaybe(settings3.yAxisArrowMode),
      xAxisLabel: stringToASTmaybe(settings3.xAxisLabel),
      yAxisLabel: stringToASTmaybe(settings3.yAxisLabel),
      squareAxes: booleanToAST(settings3.squareAxes, true),
      restrictGridToFirstQuadrant: booleanToAST(
        settings3.restrictGridToFirstQuadrant,
        false
      ),
      polarMode: booleanToAST(settings3.polarMode, false),
      lockViewport: booleanToAST(settings3.userLockedViewport, false),
      axis3D: numberArrayToASTmaybe(settings3.axis3D),
      speed3D: numberToASTmaybe(settings3.speed3D),
      worldRotation3D: numberArrayToASTmaybe(settings3.worldRotation3D),
      lockRotation: booleanToAST(settings3.userLockedRotation, false),
      disableLighting: booleanToAST(settings3.disableLighting, false)
    })
  };
}
function tickerToAST(ticker3) {
  return {
    type: "Ticker",
    handler: childLatexToAST(ticker3.handlerLatex),
    style: styleMapping({
      minStep: childLatexToAST(ticker3.minStepLatex),
      playing: booleanToAST(ticker3.playing, false)
    })
  };
}
function ignoredID(id2) {
  return id2.startsWith("__") || /^\d+$/.test(id2);
}
function idToString(id2) {
  return ignoredID(id2) ? void 0 : stringToASTmaybe(id2);
}
function itemAugToAST(item) {
  if (item.error)
    return {
      type: "Text",
      text: `Conversion error${item.type === "text" ? ": " + item.text : ""}`,
      style: null
    };
  const base2 = {
    id: idToString(item.id),
    secret: booleanToAST(item.secret, false),
    pinned: booleanToAST(item.type !== "folder" && item.pinned, false)
  };
  switch (item.type) {
    case "expression": {
      if (item.latex === void 0) return null;
      const expr = rootLatexToAST(item.latex);
      if (expr.type === "BinaryExpression" && expr.op === "~" && item.regression) {
        return {
          type: "ExprStatement",
          expr,
          style: styleMapping({
            ...base2,
            errorHidden: booleanToAST(item.errorHidden, false),
            logMode: booleanToAST(item.regression?.isLogMode, false)
          }),
          parameters: {
            type: "RegressionParameters",
            entries: [...item.regression.regressionParameters.entries()].map(
              ([id2, value]) => ({
                type: "RegressionEntry",
                variable: identifierToAST(id2),
                value: { type: "Number", value }
              })
            )
          },
          residualVariable: item.regression.residualVariable && identifierToAST(item.regression.residualVariable)
        };
      }
      return {
        type: "ExprStatement",
        expr,
        style: styleMapping({
          ...base2,
          ...expressionStyle(item)
        })
      };
    }
    case "image":
      return {
        type: "Image",
        name: item.name,
        style: styleMapping({
          ...base2,
          url: stringToASTmaybe(item.image_url),
          hoveredImage: stringToASTmaybe(item.clickableInfo?.hoveredImage),
          depressedImage: stringToASTmaybe(item.clickableInfo?.depressedImage),
          width: childLatexToASTmaybe(item.width),
          height: childLatexToASTmaybe(item.height),
          center: childLatexToASTmaybe(item.center),
          angle: item.angle && (item.angle.type !== "Constant" || item.angle.value !== 0) ? childLatexToASTmaybe(item.angle) : void 0,
          opacity: item.opacity && (item.opacity.type !== "Constant" || item.opacity.value !== 1) ? childLatexToASTmaybe(item.opacity) : void 0,
          foreground: booleanToAST(item.foreground, false),
          draggable: booleanToAST(item.draggable, false),
          onClick: childLatexToASTmaybe(item.clickableInfo?.latex),
          clickDescription: stringToASTmaybe(item.clickableInfo?.description)
        })
      };
    case "table":
      return {
        type: "Table",
        columns: item.columns.map(columnToAST),
        style: styleMapping(base2)
      };
    case "text":
      return {
        type: "Text",
        text: item.text,
        style: styleMapping(base2)
      };
    case "folder":
      return {
        type: "Folder",
        title: item.title,
        children: item.children.map(itemAugToAST).filter((e) => e !== null),
        style: styleMapping({
          ...base2,
          collapsed: booleanToAST(item.collapsed, false),
          hidden: booleanToAST(item.hidden, false)
        })
      };
  }
}
function expressionStyle(item) {
  return {
    ...columnExpressionCommonStyle(item),
    fill: childLatexToASTmaybe(item.fillOpacity),
    label: item.label && styleMapping({
      text: stringToASTmaybe(item.label.text),
      size: childLatexToASTmaybe(item.label.size),
      orientation: stringToASTmaybe(item.label.orientation),
      angle: childLatexToASTmaybe(item.label.angle),
      outline: booleanToAST(item.label.outline, true),
      showOnHover: booleanToAST(item.label.showOnHover, false),
      editableMode: stringToASTmaybe(item.label.editableMode)
    }),
    errorHidden: booleanToAST(item.errorHidden, false),
    glesmos: booleanToAST(item.glesmos, false),
    fractionDisplay: booleanToAST(item.fractionDisplay, false),
    slider: styleMapping({
      playing: booleanToAST(item.slider.isPlaying, false),
      reversed: booleanToAST(item.slider.playDirection === -1, false),
      loopMode: stringToASTmaybe(item.slider.loopMode),
      period: numberToASTmaybe(item.slider.period),
      min: childLatexToASTmaybe(item.slider.min),
      max: childLatexToASTmaybe(item.slider.max),
      step: childLatexToASTmaybe(item.slider.step)
    }),
    // We will infer whether parametric or polar domain is needed
    domain: styleMapping({
      theta: domain(item.polarDomain),
      t: domain(item.parametricDomain),
      u: domain(item.parametricDomain3Du),
      v: domain(item.parametricDomain3Dv),
      r: domain(item.parametricDomain3Dr),
      phi: domain(item.parametricDomain3Dphi)
    }),
    cdf: item.cdf && styleMapping({
      min: childLatexToASTmaybe(item.cdf.min),
      max: childLatexToASTmaybe(item.cdf.max)
    }),
    vizProps: item.vizProps && styleMapping({
      boxplot: item.vizProps.boxplot && styleMapping({
        breadth: childLatexToASTmaybe(item.vizProps.boxplot.breadth),
        axisOffset: childLatexToASTmaybe(item.vizProps.boxplot.axisOffset),
        alignedAxis: stringToASTmaybe(item.vizProps.boxplot.alignedAxis),
        showOutliers: booleanToAST(
          item.vizProps.boxplot.showOutliers,
          true
        )
      }),
      dotplotMode: stringToASTmaybe(item.vizProps.dotplotMode),
      binAlignment: stringToASTmaybe(item.vizProps.binAlignment),
      histogramMode: stringToASTmaybe(item.vizProps.histogramMode)
    }),
    onClick: childLatexToASTmaybe(item.clickableInfo?.latex),
    clickDescription: stringToASTmaybe(item.clickableInfo?.description)
  };
}
function domain(d) {
  return d && styleMapping({
    min: childLatexToASTmaybe(d.min),
    max: childLatexToASTmaybe(d.max)
  });
}
function columnExpressionCommonStyle(item) {
  const res = {
    color: typeof item.color === "string" ? stringToASTmaybe(item.color) : childLatexToASTmaybe(item.color),
    hidden: booleanToAST(item.hidden, false)
  };
  if (item.lines) {
    res.lines = item.lines ? styleMapping(
      {
        opacity: childLatexToASTmaybe(item.lines.opacity),
        width: childLatexToASTmaybe(item.lines.width),
        style: stringToASTmaybe(item.lines.style)
      },
      { includeEmpty: true }
    ) : void 0;
  }
  if (item.points) {
    res.points = styleMapping(
      {
        opacity: childLatexToASTmaybe(item.points.opacity),
        size: childLatexToASTmaybe(item.points.size),
        style: stringToASTmaybe(item.points.style),
        drag: stringToASTmaybe(item.points.dragMode)
      },
      { includeEmpty: true }
    );
  }
  return res;
}
function columnToAST(col) {
  return {
    type: "ExprStatement",
    expr: col.latex === void 0 ? {
      type: "ListExpression",
      values: col.values.map((e) => childLatexToAST(e))
    } : col.latex.type === "Identifier" ? {
      type: "BinaryExpression",
      op: "=",
      left: childLatexToAST(col.latex),
      right: {
        type: "ListExpression",
        values: col.values.map(childLatexToAST)
      }
    } : childLatexToAST(col.latex),
    style: styleMapping({
      id: idToString(col.id),
      ...columnExpressionCommonStyle(col)
    })
  };
}
function styleMapping(from, { includeEmpty } = { includeEmpty: false }) {
  const nonemptyEntries = Object.entries(from).filter(
    ([_, value]) => value != null
  );
  return nonemptyEntries.length > 0 || includeEmpty ? {
    type: "StyleMapping",
    entries: nonemptyEntries.map(([prop, value]) => ({
      type: "MappingEntry",
      property: {
        type: "String",
        value: prop
      },
      expr: value
    }))
  } : null;
}
function booleanToAST(bool, defaultValue) {
  return bool === void 0 || bool === defaultValue ? void 0 : identifierToAST({ symbol: bool ? "true" : "false" });
}
function identifierToAST(name) {
  return {
    type: "Identifier",
    name: name.symbol
  };
}
function numberArrayToASTmaybe(nums) {
  return nums !== void 0 ? {
    type: "ListExpression",
    values: nums.map((num) => ({
      type: "Number",
      value: num
    }))
  } : void 0;
}
function numberToASTmaybe(num) {
  return num !== void 0 ? {
    type: "Number",
    value: num
  } : void 0;
}
function stringToASTmaybe(str) {
  return str !== void 0 ? {
    type: "String",
    value: str
  } : void 0;
}
function childLatexToASTmaybe(e) {
  return e && childLatexToAST(e);
}
function functionCallToAST(e) {
  return {
    type: "CallExpression",
    callee: identifierToAST(e.callee),
    arguments: e.args.map(childLatexToAST)
  };
}
function childLatexToAST(e) {
  switch (e.type) {
    case "Constant":
      return numberToASTmaybe(e.value);
    case "Identifier":
      return identifierToAST(e);
    case "FunctionCall":
      return e.callee.symbol === "factorial" && e.args.length === 1 ? {
        type: "PostfixExpression",
        op: "factorial",
        expr: childLatexToAST(e.args[0])
      } : functionCallToAST(e);
    case "Prime":
      return {
        type: "PrimeExpression",
        expr: functionCallToAST(e.arg),
        order: e.order
      };
    case "Integral":
      return {
        type: "RepeatedExpression",
        name: "integral",
        index: identifierToAST(e.differential),
        start: childLatexToAST(e.start),
        end: childLatexToAST(e.end),
        expr: childLatexToAST(e.integrand)
      };
    case "Derivative":
      return {
        type: "DerivativeExpression",
        expr: childLatexToAST(e.arg),
        variable: identifierToAST(e.variable)
      };
    case "List":
      return {
        type: "ListExpression",
        values: e.args.map(childLatexToAST)
      };
    case "Range":
      return {
        type: "RangeExpression",
        startValues: e.start.map(childLatexToAST),
        endValues: e.end.map(childLatexToAST)
      };
    case "ListAccess":
      return {
        type: "ListAccessExpression",
        expr: childLatexToAST(e.list),
        index: childLatexToAST(e.index)
      };
    case "DotAccess":
      return e.property.type === "FunctionCall" ? {
        type: "CallExpression",
        callee: {
          type: "MemberExpression",
          object: childLatexToAST(e.object),
          property: identifierToAST(e.property.callee)
        },
        arguments: e.property.args.map(childLatexToAST)
      } : {
        type: "MemberExpression",
        object: childLatexToAST(e.object),
        property: identifierToAST(e.property)
      };
    case "OrderedPairAccess":
      return {
        type: "MemberExpression",
        object: childLatexToAST(e.point),
        property: identifierToAST({ symbol: e.index })
      };
    case "Seq":
      if (e.args.length <= 1)
        throw Error("Programming Error: Expected at least 2 elements in Seq");
      return {
        type: "SequenceExpression",
        left: childLatexToAST(e.args[0]),
        right: e.args.length > 2 ? childLatexToAST({
          type: "Seq",
          args: e.args.slice(1),
          parenWrapped: false
        }) : childLatexToAST(e.args[1]),
        parenWrapped: e.parenWrapped
      };
    case "UpdateRule":
      return {
        type: "UpdateRule",
        variable: identifierToAST(e.variable),
        expr: childLatexToAST(e.expression)
      };
    case "ListComprehension":
      return {
        type: "ListComprehension",
        expr: childLatexToAST(e.expr),
        assignments: e.assignments.map(assignmentExprToAST),
        parameters: e.parameters.map(
          ({ identifier, open, bounds: [min, max] }) => ({
            identifier: identifierToAST(identifier),
            open,
            bounds: [childLatexToAST(min), childLatexToAST(max)]
          })
        ),
        bracketWrapped: e.bracketWrapped
      };
    case "Substitution":
      return {
        type: "Substitution",
        body: childLatexToAST(e.body),
        assignments: e.assignments.map(assignmentExprToAST)
      };
    case "Piecewise": {
      const piecewiseBranches = [];
      let curr = e;
      while (curr.type === "Piecewise") {
        if (curr.condition === true) {
          curr = curr.consequent;
          break;
        }
        piecewiseBranches.push({
          type: "PiecewiseBranch",
          condition: childLatexToAST(curr.condition),
          consequent: childLatexToAST(curr.consequent)
        });
        curr = curr.alternate;
      }
      if (!AugState_exports.Latex.isConstant(curr, NaN)) {
        if (piecewiseBranches.length === 0) {
          if (!AugState_exports.Latex.isConstant(curr, 1))
            throw new Error(
              "Programming error: first branch in Aug piecewise is unconditional but not 1."
            );
        } else
          piecewiseBranches.push({
            type: "PiecewiseBranch",
            condition: null,
            consequent: childLatexToAST(curr)
          });
      }
      return {
        type: "PiecewiseExpression",
        branches: piecewiseBranches
      };
    }
    case "Restriction":
      return {
        type: "Restriction",
        condition: e.condition === true ? true : childLatexToAST(e.condition)
      };
    case "Or":
      return {
        type: "Or",
        left: childLatexToAST(e.left),
        right: childLatexToAST(e.right)
      };
    case "RepeatedOperator":
      return {
        type: "RepeatedExpression",
        name: e.name === "Product" ? "product" : "sum",
        index: identifierToAST(e.index),
        start: childLatexToAST(e.start),
        end: childLatexToAST(e.end),
        expr: childLatexToAST(e.expression)
      };
    case "BinaryOperator":
      if (e.name === "Multiply" && e.left.type === "Constant" && e.right.type === "BinaryOperator" && e.right.name === "Exponent" && e.right.left.type === "Constant" && e.right.left.value === 10 && e.right.right.type === "Constant" && Number.isSafeInteger(e.right.right.value)) {
        return {
          type: "Number",
          value: e.left.value * e.right.left.value ** e.right.right.value
        };
      }
      return {
        type: "BinaryExpression",
        op: binopMap[e.name],
        left: childLatexToAST(e.left),
        right: childLatexToAST(e.right)
      };
    case "Negative":
      return {
        type: "PrefixExpression",
        op: "-",
        expr: childLatexToAST(e.arg)
      };
    case "Positive":
      return {
        type: "PrefixExpression",
        op: "+",
        expr: childLatexToAST(e.arg)
      };
    case "Norm":
      return {
        type: "Norm",
        expr: childLatexToAST(e.arg)
      };
    case "Factorial":
      return childLatexToAST({
        type: "FunctionCall",
        callee: {
          type: "Identifier",
          symbol: "factorial"
        },
        args: [e.arg]
      });
    case "Comparator":
      return {
        type: "BinaryExpression",
        op: e.operator,
        left: childLatexToAST(e.left),
        right: childLatexToAST(e.right)
      };
    case "ComparatorChain":
      return {
        type: "ComparatorChain",
        args: e.args.map(childLatexToAST),
        symbols: e.symbols
      };
    case "AssignmentExpression":
      return assignmentExprToAST(e);
    default:
      e;
      throw new Error(
        `Programming Error in augToAST: Unexpected Aug node ${e.type}`
      );
  }
}
var binopMap = {
  Add: "+",
  Subtract: "-",
  Multiply: "*",
  CrossMultiply: "cross",
  Divide: "/",
  Exponent: "^"
};
function assignmentExprToAST(e) {
  return {
    type: "AssignmentExpression",
    variable: identifierToAST(e.variable),
    expr: childLatexToAST(e.expression)
  };
}
function rootLatexToAST(e) {
  switch (e.type) {
    case "Equation":
    case "Assignment":
      return {
        type: "BinaryExpression",
        op: "=",
        left: childLatexToAST(e.left),
        right: childLatexToAST(e.right)
      };
    case "FunctionDefinition":
      return {
        type: "BinaryExpression",
        op: "=",
        left: childLatexToAST({
          type: "FunctionCall",
          callee: e.symbol,
          args: e.argSymbols
        }),
        right: childLatexToAST(e.definition)
      };
    case "Visualization":
      return {
        type: "CallExpression",
        callee: identifierToAST(e.callee),
        arguments: e.args.map(childLatexToAST)
      };
    case "Regression":
      return {
        type: "BinaryExpression",
        op: "~",
        left: childLatexToAST(e.left),
        right: childLatexToAST(e.right)
      };
    default:
      return childLatexToAST(e);
  }
}

// ../dsm/text-mode-core/down/diagnostics.ts
function diagnostic(severity, message, pos2) {
  return {
    message,
    severity,
    from: pos2?.from ?? 0,
    to: pos2?.to ?? 0
  };
}
function error(message, pos2) {
  return diagnostic("error", message, pos2);
}
function warning(message, pos2) {
  return diagnostic("warning", message, pos2);
}
var DiagnosticsState = class {
  constructor(diagnostics = []) {
    this.diagnostics = diagnostics;
  }
  pushError(message, pos2) {
    this.diagnostics.push(error(message, pos2));
  }
  pushWarning(message, pos2) {
    this.diagnostics.push(warning(message, pos2));
  }
};

// ../dsm/text-mode-core/down/staticEval.ts
function evalExpr(diagnostics, expr) {
  switch (expr.type) {
    case "Number":
      return expr.value;
    case "String":
      return expr.value;
    case "PrefixExpression": {
      const value = evalExpr(diagnostics, expr.expr);
      if (value === null) return null;
      switch (expr.op) {
        case "+":
          return value;
        case "-":
          return -value;
        default:
          expr;
          return null;
      }
    }
    case "ListExpression": {
      let someNotNumber = false;
      const res = expr.values.map((e) => {
        const r = evalExpr(diagnostics, e);
        if (typeof r === "number") return r;
        diagnostics.push(
          error(
            "Static-evaluated lists may only contain numbers",
            "pos" in expr ? expr.pos : void 0
          )
        );
        someNotNumber = true;
        return 0;
      });
      if (someNotNumber) return null;
      return res;
    }
    case "Identifier":
      if (expr.name in builtinMap) {
        return builtinMap[expr.name];
      } else {
        diagnostics.push(
          error(
            `Undefined identifier: ${expr.name.replace("_", "")}`,
            "pos" in expr ? expr.pos : void 0
          )
        );
        return null;
      }
    default:
      diagnostics.push(
        error(
          `Static evaluation of ${expr.type} has not yet been implemented`,
          "pos" in expr ? expr.pos : void 0
        )
      );
      return null;
  }
}
var builtinMap = {
  false: false,
  true: true,
  pi: Math.PI,
  tau: 2 * Math.PI,
  e: Math.E,
  infty: Infinity
};

// ../dsm/text-mode-core/down/style/defaults.ts
var defaults_exports = {};
__export(defaults_exports, {
  column: () => column,
  expression: () => expression,
  folder: () => folder,
  image: () => image,
  regression: () => regression,
  settings: () => settings,
  table: () => table,
  text: () => text,
  ticker: () => ticker
});
var settings = {
  viewport: {},
  squareAxes: true,
  // empty randomSeed will be filled in later in the process
  randomSeed: "",
  xAxisLabel: "",
  yAxisLabel: "",
  xAxisArrowMode: "NONE",
  yAxisArrowMode: "NONE",
  xAxisMinorSubdivisions: 0,
  yAxisMinorSubdivisions: 0,
  xAxisStep: 0,
  yAxisStep: 0,
  degreeMode: false,
  complex: false,
  showGrid: true,
  showXAxis: true,
  showYAxis: true,
  xAxisNumbers: true,
  yAxisNumbers: true,
  polarNumbers: true,
  restrictGridToFirstQuadrant: false,
  polarMode: false,
  lockViewport: false,
  // TODO-graph-state: Do we want the default to be empty, then filled in with grapher type?
  product: "graphing",
  axis3D: [0, 0, 1],
  speed3D: 0,
  worldRotation3D: [
    -0.5132799671593364,
    -0.8314696123025455,
    -0.212607523691814,
    0.7681777567114166,
    -0.555570233019602,
    0.3181896451432085,
    -0.3826834323650897,
    0,
    0.9238795325112867
  ],
  lockRotation: false,
  disableLighting: false
};
var ticker = {
  minStep: constant(0),
  playing: false
};
var itemBase = {
  secret: false
};
var nonFolderBase = {
  ...itemBase,
  pinned: false
};
var columnExpressionCommon2 = {
  // empty color will be filled in later in the process
  color: "",
  hidden: false,
  points: {
    opacity: constant(0.9),
    size: constant(9),
    style: "POINT",
    drag: "NONE"
  },
  lines: {
    opacity: constant(0.9),
    width: constant(2.5),
    style: "SOLID"
  }
};
var clickable = {
  onClick: null,
  clickDescription: ""
};
var defaultBounds = {
  min: void 0,
  max: void 0
};
var expression = {
  ...nonFolderBase,
  ...columnExpressionCommon2,
  ...clickable,
  label: {
    text: "",
    size: constant(1),
    orientation: "default",
    angle: constant(0),
    outline: true,
    showOnHover: false,
    editableMode: "NONE"
  },
  errorHidden: false,
  glesmos: false,
  fill: void 0,
  logMode: false,
  fractionDisplay: false,
  slider: {
    playing: false,
    reversed: false,
    loopMode: "LOOP_FORWARD_REVERSE",
    period: 4e3,
    min: void 0,
    max: void 0,
    step: void 0
  },
  cdf: defaultBounds,
  domain: {
    theta: defaultBounds,
    t: defaultBounds,
    u: defaultBounds,
    v: defaultBounds,
    r: defaultBounds,
    phi: defaultBounds
  }
  // TODO vizProps
  // vizProps
};
var regression = {
  ...nonFolderBase,
  errorHidden: false,
  logMode: false
};
var table = nonFolderBase;
var column = {
  ...columnExpressionCommon2
};
var image = {
  ...nonFolderBase,
  ...clickable,
  width: constant(10),
  height: constant(10),
  center: {
    type: "Seq",
    args: [constant(0), constant(0)],
    parenWrapped: true
  },
  angle: constant(0),
  opacity: constant(1),
  foreground: false,
  draggable: false,
  url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjYGBg+A8AAQQBAHAgZQsAAAAASUVORK5CYII=",
  hoveredImage: "",
  depressedImage: ""
};
var text = nonFolderBase;
var folder = {
  ...itemBase,
  hidden: false,
  collapsed: false
};

// ../dsm/text-mode-core/down/style/hydrate.ts
function hydrate(ds, styleMapping2, defaults, schema, itemType, path = "") {
  const smEntries = styleMapping2?.entries ?? [];
  for (const entry of smEntries) {
    if (!(entry.property.value in schema)) {
      ds.pushWarning(
        `Property ${entry.property.value} unexpected on ${itemType}${path}`,
        entry.property.pos
      );
    }
  }
  const res = {};
  let hasNull = false;
  for (const _key in schema) {
    let pushError2 = function(msg) {
      ds.pushError(msg, chosenEntry?.expr?.pos);
      hasNull = true;
    };
    var pushError = pushError2;
    const key = _key;
    const schemaType = schema[key];
    const matchingEntries = smEntries.filter(
      (entry) => entry.property.value === key
    );
    if (matchingEntries.length > 1)
      matchingEntries.slice(1).forEach(
        (entry) => ds.pushWarning(
          `Duplicate property ${entry.property.value} on ${itemType}${path}`,
          entry.property.pos
        )
      );
    const chosenEntry = matchingEntries[0];
    if (chosenEntry?.expr === null)
      throw Error("Null expression in style mapping");
    const givenValue = matchingEntries[0]?.expr ?? void 0;
    const errPath = itemType + path + "." + key;
    if (typeof schemaType === "object" && schemaType.type === "schema") {
      if (givenValue === void 0) {
        if (schemaType.fillDefaults) {
          res[key] = defaults[key];
        } else {
          res[key] = void 0;
        }
      } else if (givenValue.type === "StyleMapping") {
        const style = hydrate(
          ds,
          givenValue,
          defaults[key],
          schemaType.schema,
          itemType,
          path + "." + key
        );
        if (style === null) hasNull = true;
        res[key] = style;
      } else {
        const evaluated = evalExpr(ds.diagnostics, givenValue);
        if (schemaType.orBool && typeof evaluated === "boolean")
          res[key] = evaluated;
        else
          pushError2(
            `Expected ${errPath} to be style mapping, but got primitive`
          );
      }
    } else if (givenValue === void 0) {
      res[key] = defaults[key];
    } else {
      if (givenValue.type === "StyleMapping") {
        pushError2(`Expected ${errPath} to be primitive, but got style mapping`);
      } else if (schemaType === "expr") {
        res[key] = childExprToAug(givenValue);
      } else if (schemaType === "color") {
        if (givenValue.type === "String") {
          res[key] = givenValue.value;
        } else {
          res[key] = childExprToAug(givenValue);
        }
      } else {
        const evaluated = evalExpr(ds.diagnostics, givenValue);
        if (evaluated === null) {
          hasNull = true;
        } else if (typeof schemaType !== "string") {
          switch (schemaType.type) {
            case "number[]":
              if (!Array.isArray(evaluated) || evaluated.some((e) => typeof e !== "number") || evaluated.length !== schemaType.length) {
                const j = JSON.stringify(evaluated);
                pushError2(
                  `Expected ${errPath} to evaluate to a list of ${schemaType.length} numbers, but got '${j}'`
                );
              }
              break;
            case "enum":
              if (typeof evaluated !== "string")
                pushError2(
                  `Expected ${errPath} to evaluate to a string, but got ${typeof evaluated}`
                );
              else if (!schemaType.enum.includes(evaluated))
                pushError2(
                  `Expected ${errPath} to be one of ${JSON.stringify(schemaType.enum)}, but got ${JSON.stringify(evaluated)} instead`
                );
              break;
          }
        } else {
          if (typeof evaluated !== schemaType)
            pushError2(
              `Expected ${errPath} to evaluate to ${schemaType}, but got ${typeof evaluated}`
            );
        }
        if (evaluated !== null) res[key] = evaluated;
      }
    }
  }
  return hasNull ? null : res;
}

// ../dsm/text-mode-core/down/style/schema.ts
var settings2 = {
  product: enumL(["graphing", "geometry-calculator", "graphing-3d"]),
  viewport: schemaL(
    {
      xmin: "number",
      ymin: "number",
      zmin: "number",
      xmax: "number",
      ymax: "number",
      zmax: "number"
    },
    { fillDefaults: true }
  ),
  squareAxes: "boolean",
  // empty randomSeed will be filled in later in the process
  randomSeed: "string",
  xAxisLabel: "string",
  yAxisLabel: "string",
  xAxisArrowMode: enumL(["NONE", "POSITIVE", "BOTH"]),
  yAxisArrowMode: enumL(["NONE", "POSITIVE", "BOTH"]),
  xAxisMinorSubdivisions: "number",
  yAxisMinorSubdivisions: "number",
  xAxisStep: "number",
  yAxisStep: "number",
  degreeMode: "boolean",
  complex: "boolean",
  showGrid: "boolean",
  showXAxis: "boolean",
  showYAxis: "boolean",
  xAxisNumbers: "boolean",
  yAxisNumbers: "boolean",
  polarNumbers: "boolean",
  restrictGridToFirstQuadrant: "boolean",
  polarMode: "boolean",
  lockViewport: "boolean",
  axis3D: {
    type: "number[]",
    length: 3
  },
  speed3D: "number",
  worldRotation3D: { type: "number[]", length: 9 },
  lockRotation: "boolean",
  disableLighting: "boolean"
};
var ticker2 = {
  minStep: "expr",
  playing: "boolean"
};
var base = {
  // empty ID will be filled in later in the process
  id: "string"
};
var itemBase2 = {
  ...base,
  secret: "boolean"
};
var nonFolderBase2 = {
  ...itemBase2,
  pinned: "boolean"
};
var columnExpressionCommon3 = {
  id: "string",
  // empty color will be filled in later in the process
  color: "color",
  hidden: "boolean",
  points: schemaL(
    {
      opacity: "expr",
      size: "expr",
      style: enumL(["POINT", "OPEN", "CROSS"]),
      drag: enumL(["NONE", "X", "Y", "XY", "AUTO"])
    },
    { orBool: true }
  ),
  lines: schemaL(
    {
      opacity: "expr",
      width: "expr",
      style: enumL(["SOLID", "DASHED", "DOTTED"])
    },
    { orBool: true }
  )
};
var clickable2 = {
  onClick: "expr",
  clickDescription: "string"
};
var boundsSchema = schemaL({
  min: "expr",
  max: "expr"
});
var expression2 = {
  ...nonFolderBase2,
  ...columnExpressionCommon3,
  ...clickable2,
  label: schemaL({
    text: "string",
    size: "expr",
    orientation: {
      type: "enum",
      enum: [
        "default",
        "center",
        "center_auto",
        "auto_center",
        "above",
        "above_left",
        "above_right",
        "above_auto",
        "below",
        "below_left",
        "below_right",
        "below_auto",
        "left",
        "auto_left",
        "right",
        "auto_right"
      ]
    },
    angle: "expr",
    outline: "boolean",
    showOnHover: "boolean",
    editableMode: enumL(["MATH", "TEXT", "NONE"])
  }),
  errorHidden: "boolean",
  glesmos: "boolean",
  fill: "expr",
  fractionDisplay: "boolean",
  slider: schemaL({
    playing: "boolean",
    reversed: "boolean",
    loopMode: enumL([
      "LOOP_FORWARD_REVERSE",
      "LOOP_FORWARD",
      "PLAY_ONCE",
      "PLAY_INDEFINITELY"
    ]),
    period: "number",
    min: "expr",
    max: "expr",
    step: "expr"
  }),
  domain: schemaL({
    theta: boundsSchema,
    t: boundsSchema,
    u: boundsSchema,
    v: boundsSchema,
    rho: boundsSchema,
    phi: boundsSchema
  }),
  cdf: boundsSchema
  // TODO vizProps
  // vizProps
};
var regression2 = {
  ...nonFolderBase2,
  errorHidden: "boolean",
  logMode: "boolean"
};
var table2 = nonFolderBase2;
var column2 = {
  ...base,
  ...columnExpressionCommon3
};
var image2 = {
  ...nonFolderBase2,
  ...clickable2,
  width: "expr",
  height: "expr",
  center: "expr",
  angle: "expr",
  opacity: "expr",
  foreground: "boolean",
  draggable: "boolean",
  url: "string",
  hoveredImage: "string",
  depressedImage: "string"
};
var text2 = nonFolderBase2;
var folder2 = {
  ...itemBase2,
  hidden: "boolean",
  collapsed: "boolean"
};
function enumL(L) {
  return { type: "enum", enum: L };
}
function schemaL(s, t = {}) {
  return {
    type: "schema",
    schema: s,
    fillDefaults: t.fillDefaults ?? false,
    orBool: t.orBool ?? false
  };
}

// ../dsm/text-mode-core/down/astToAug.ts
var DownState2 = class extends DiagnosticsState {
  constructor(cfg, diagnostics) {
    super(diagnostics);
    this.cfg = cfg;
    this.hasBlockingError = false;
  }
};
function astToAug(cfg, analysis) {
  const state = {
    version: 9,
    settings: {
      viewport: {}
    },
    expressions: {
      list: []
    }
  };
  const { diagnostics: parseErrors, program, mapIDstmt } = analysis;
  const diagnostics = [...parseErrors];
  const ds = new DownState2(cfg, diagnostics);
  for (const stmt of program.children) {
    const stmtAug = statementToAug(ds, state, stmt);
    if (stmtAug === null) {
      ds.hasBlockingError = true;
    } else if (stmtAug.type === "settings") {
      state.settings = { ...state.settings, ...stmtAug.settings };
    } else if (stmtAug.type === "ticker") {
      if (state.expressions.ticker !== void 0)
        ds.pushWarning("Duplicate ticker, ignoring this one", stmt.pos);
      state.expressions.ticker = stmtAug.ticker;
    } else {
      state.expressions.list.push(stmtAug);
    }
  }
  fixEmptyColors(ds.cfg, state);
  return [
    {
      diagnostics,
      program,
      mapIDstmt
    },
    ds.hasBlockingError ? null : state
  ];
}
function fixEmptyColors(cfg, state) {
  const colors = Object.values(cfg.colors);
  let colorIndex = 0;
  forEachExpr(state.expressions.list, (item) => {
    if ("color" in item) {
      if (item.color === "") {
        item.color = colors[colorIndex];
        colorIndex = (colorIndex + 1) % colors.length;
      } else if (typeof item.color === "string" && colors.includes(item.color)) {
        colorIndex = (colors.indexOf(item.color) + 1) % colors.length;
      }
    }
  });
}
function forEachExpr(items, func) {
  items.forEach((item) => {
    func(item);
    if (item.type === "table") {
      item.columns.forEach(func);
    } else if (item.type === "folder") {
      forEachExpr(item.children, func);
    }
  });
}
function statementToAug(ds, state, stmt) {
  switch (stmt.type) {
    case "Settings":
      return settingsToAug(ds, stmt.style);
    case "Ticker":
      return tickerToAug(ds, stmt.style, stmt.handler);
    case "ExprStatement":
      return expressionToAug(ds, stmt.style, stmt);
    case "Table":
      return tableToAug(ds, stmt.style, stmt);
    case "Image":
      return imageToAug(ds, stmt.style, stmt);
    case "Text":
      return textToAug(ds, stmt.style, stmt);
    case "Folder":
      return folderToAug(ds, stmt.style, stmt, state);
  }
}
function textToAug(ds, styleMapping2, stmt) {
  const style = hydrate(ds, styleMapping2, text, text2, "text");
  return style !== null ? {
    ...exprBase(style, stmt),
    type: "text",
    text: stmt.text
  } : null;
}
function regressionToAug(ds, styleMapping2, stmt, exprAST) {
  const expr = {
    type: "Regression",
    left: childExprToAug(exprAST.left),
    right: childExprToAug(exprAST.right)
  };
  const style = hydrate(
    ds,
    styleMapping2,
    regression,
    regression2,
    "regression"
  );
  if (style === null) return null;
  const params = (stmt.parameters?.entries ?? []).map(
    ({ variable, value }) => {
      const evaluated = evalExpr(ds.diagnostics, value);
      if (typeof evaluated !== "number") {
        ds.pushError(
          `Expected regression parameter to evaluate to number, but got ${typeof evaluated}`,
          value.pos
        );
        return null;
      }
      return [identifierToAug(variable), evaluated];
    }
  );
  if (!everyNonNull(params)) return null;
  return {
    type: "expression",
    ...exprBase(style, stmt),
    latex: expr,
    regression: {
      isLogMode: style.logMode,
      residualVariable: stmt.residualVariable && identifierToAug(stmt.residualVariable),
      regressionParameters: new Map(params)
    },
    color: "",
    errorHidden: style.errorHidden,
    hidden: false,
    glesmos: false,
    fillOpacity: void 0,
    fractionDisplay: false,
    slider: {},
    vizProps: {}
  };
}
function expressionToAug(ds, styleMapping2, stmt) {
  if (stmt.expr.type === "BinaryExpression" && stmt.expr.op === "~") {
    return regressionToAug(ds, styleMapping2, stmt, stmt.expr);
  }
  const expr = childExprToAug(stmt.expr);
  const style = hydrate(
    ds,
    styleMapping2,
    expression,
    expression2,
    "expression"
  );
  if (style === null) return null;
  return {
    type: "expression",
    // Use empty string as an ID placeholder. These will get filled in at the end
    ...exprBase(style, stmt),
    latex: expr,
    label: style.label && style.label.text !== "" ? {
      ...style.label,
      size: style.label.size,
      angle: style.label.angle
    } : void 0,
    // hidden from common
    errorHidden: style.errorHidden,
    glesmos: style.glesmos,
    fillOpacity: style.fill,
    fractionDisplay: style.fractionDisplay,
    slider: style.slider ? {
      period: style.slider.period,
      loopMode: style.slider.loopMode,
      playDirection: style.slider.reversed ? -1 : 1,
      isPlaying: style.slider.playing,
      min: style.slider.min,
      max: style.slider.max,
      step: style.slider.step
    } : {},
    polarDomain: style.domain?.theta,
    parametricDomain: style.domain?.t,
    parametricDomain3Du: style.domain?.u,
    parametricDomain3Dv: style.domain?.v,
    parametricDomain3Dr: style.domain?.r,
    parametricDomain3Dphi: style.domain?.phi,
    cdf: style.cdf && !exprEvalSameDeep(style.cdf, { min: -Infinity, max: Infinity }) ? { min: style.cdf.min, max: style.cdf.max } : void 0,
    // TODO: vizProps
    vizProps: {},
    clickableInfo: style.onClick ? {
      description: style.clickDescription,
      latex: style.onClick
    } : void 0,
    ...columnExpressionCommonStyle2(ds, style)
  };
}
function tickerToAug(ds, styleMapping2, handler) {
  const hydrated = hydrate(
    ds,
    styleMapping2,
    ticker,
    ticker2,
    "ticker"
  );
  if (hydrated === null) return null;
  return {
    type: "ticker",
    ticker: {
      handlerLatex: childExprToAug(handler),
      minStepLatex: hydrated.minStep,
      playing: hydrated.playing
    }
  };
}
function settingsToAug(ds, styleMapping2) {
  const hydrated = hydrate(
    ds,
    styleMapping2,
    settings,
    settings2,
    "settings"
  );
  if (hydrated === null) return null;
  return {
    type: "settings",
    settings: processSettings(hydrated)
  };
}
function processSettings(hydrated) {
  const res = {
    ...hydrated,
    userLockedViewport: hydrated.lockViewport,
    userLockedRotation: hydrated.lockRotation
  };
  delete res.lockViewport;
  delete res.lockRotation;
  if (res.product !== "graphing-3d") {
    res.viewport = { ...res.viewport };
    delete res.viewport?.zmin;
    delete res.viewport?.zmax;
    delete res.axis3D;
    delete res.speed3D;
    delete res.worldRotation3D;
    delete res.userLockedRotation;
    delete res.disableLighting;
  }
  if (res.product === "graphing") {
    delete res.product;
  }
  return res;
}
function columnExpressionCommonStyle2(ds, style) {
  const res = {
    color: typeof style.color === "string" ? style.color : style.color.type === "Identifier" && ds.cfg.colors[style.color.symbol.replace("_", "")] || style.color,
    hidden: style.hidden,
    points: style.points === true ? {} : style.points === false ? { size: constant(0) } : style.points ? exprEvalSame(style.points.opacity, 0) || exprEvalSame(style.points.size, 0) ? { size: constant(0) } : {
      opacity: style.points.opacity,
      size: style.points.size,
      style: style.points.style,
      dragMode: style.points.drag
    } : void 0,
    lines: style.lines === true ? {} : style.lines === false ? { width: constant(0) } : style.lines ? exprEvalSame(style.lines.opacity, 0) || exprEvalSame(style.lines.width, 0) ? { width: constant(0) } : {
      opacity: style.lines.opacity,
      width: style.lines.width,
      style: style.lines.style
    } : void 0
  };
  return res;
}
function exprBase(style, stmt) {
  return {
    id: stmt.id,
    secret: style.secret,
    pinned: style.pinned
  };
}
function tableToAug(ds, styleMapping2, stmt) {
  const style = hydrate(ds, styleMapping2, table, table2, "table");
  if (style === null) return null;
  const base2 = exprBase(style, stmt);
  const resultColumns = stmt.columns.map((col) => tableColumnToAug(ds, col));
  if (!everyNonNull(resultColumns)) return null;
  return {
    type: "table",
    ...base2,
    columns: resultColumns
  };
}
function tableColumnToAug(ds, column3) {
  const style = hydrate(
    ds,
    column3.style,
    column,
    column2,
    "column"
  );
  if (style === null) return null;
  const { expr } = column3;
  const base2 = {
    type: "column",
    id: column3.id,
    ...columnExpressionCommonStyle2(ds, style)
  };
  if (expr.type === "BinaryExpression" && expr.op === "=") {
    if (expr.left.type !== "Identifier") {
      ds.pushError(
        `Expected column to assign to an identifier, but got ${expr.left.type}`,
        expr.left.pos
      );
      return null;
    } else if (expr.right.type !== "ListExpression") {
      ds.pushError(
        `Expected table assignment to assign from a ListExpression, but got ${expr.right.type}`,
        expr.right.pos
      );
      return null;
    } else {
      return {
        ...base2,
        values: expr.right.values.map(childExprToAug),
        latex: childExprToAug(expr.left)
      };
    }
  } else {
    const list = childExprToAug(expr);
    return {
      ...base2,
      values: [],
      latex: expr.type === "ListExpression" ? (
        // Desmos complains about a plain list expression as latex
        // so placate it by adding zero
        {
          type: "BinaryOperator",
          name: "Add",
          left: constant(0),
          right: list
        }
      ) : list
    };
  }
}
function imageToAug(ds, styleMapping2, expr) {
  const style = hydrate(ds, styleMapping2, image, image2, "image");
  if (style === null) return null;
  const res = {
    type: "image",
    ...exprBase(style, expr),
    image_url: style.url,
    name: expr.name,
    width: style.width,
    height: style.height,
    center: style.center,
    angle: style.angle,
    opacity: style.opacity,
    foreground: style.foreground,
    draggable: style.draggable,
    clickableInfo: style.onClick ? {
      description: style.clickDescription,
      latex: style.onClick,
      hoveredImage: style.hoveredImage,
      depressedImage: style.depressedImage
    } : void 0
  };
  return res;
}
function folderToAug(ds, styleMapping2, expr, state) {
  const children = [];
  const style = hydrate(
    ds,
    styleMapping2,
    folder,
    folder2,
    "folder"
  );
  if (style === null) return null;
  for (const child of expr.children) {
    const stmtAug = statementToAug(ds, state, child);
    if (stmtAug !== null) {
      if (stmtAug.type === "folder") {
        ds.pushError("Nested folders are not yet implemented", child.pos);
        return null;
      } else if (stmtAug.type === "settings") {
        ds.pushError("Settings may not be in a folder", child.pos);
        return null;
      } else if (stmtAug.type === "ticker") {
        ds.pushError("Ticker may not be in a folder", child.pos);
        return null;
      } else {
        children.push(stmtAug);
      }
    }
  }
  return {
    type: "folder",
    id: expr.id,
    secret: style.secret,
    hidden: style.hidden,
    collapsed: style.collapsed,
    title: expr.title,
    children
  };
}
function exprEvalSame(expr, expected) {
  const evaluated = evalExpr([], childLatexToAST(expr));
  return evaluated === null ? false : evaluated === expected;
}
function exprEvalSameDeep(exprMap, expected) {
  for (const key in expected)
    if (!exprEvalSame(exprMap[key], expected[key])) return false;
  return true;
}
function childExprToAug(expr) {
  if (expr.type === "StyleValue") throw Error("Unexpected style value");
  switch (expr.type) {
    case "Number":
      return constant(expr.value);
    case "Identifier":
      return identifierToAug(expr);
    case "String":
      throw Error("Unexpected string in expression");
    case "RepeatedExpression":
      if (expr.name === "integral") {
        return {
          type: "Integral",
          differential: identifierToAug(expr.index),
          start: childExprToAug(expr.start),
          end: childExprToAug(expr.end),
          integrand: childExprToAug(expr.expr)
        };
      } else {
        return {
          type: "RepeatedOperator",
          name: expr.name === "sum" ? "Sum" : "Product",
          index: identifierToAug(expr.index),
          start: childExprToAug(expr.start),
          end: childExprToAug(expr.end),
          expression: childExprToAug(expr.expr)
        };
      }
    case "RangeExpression":
      return {
        type: "Range",
        start: expr.startValues.map(childExprToAug),
        end: expr.endValues.map(childExprToAug)
      };
    case "ListExpression":
      return {
        type: "List",
        args: expr.values.map(childExprToAug)
      };
    case "ListComprehension":
      return {
        type: "ListComprehension",
        expr: childExprToAug(expr.expr),
        assignments: expr.assignments.map(assignment),
        parameters: expr.parameters.map(
          ({ identifier, open, bounds: [min, max] }) => ({
            identifier: identifierToAug(identifier),
            open,
            bounds: [childExprToAug(min), childExprToAug(max)]
          })
        ),
        bracketWrapped: expr.bracketWrapped
      };
    case "Substitution":
      return {
        type: "Substitution",
        body: childExprToAug(expr.body),
        assignments: expr.assignments.map(assignment)
      };
    case "PiecewiseExpression":
      return piecewiseToAug(expr.branches);
    case "Restriction": {
      if (expr.condition === true)
        return { type: "Restriction", condition: true };
      const condition = childExprToAug(expr.condition);
      if (!isRestrictionBoolean(condition))
        throw Error("Invalid restriction condition");
      return {
        type: "Restriction",
        condition
      };
    }
    case "Or": {
      const left = childExprToAug(expr.left);
      const right = childExprToAug(expr.right);
      if (!isRestrictionBoolean(left) || !isRestrictionBoolean(right))
        throw Error("Invalid or condition");
      return { type: "Or", left, right };
    }
    case "PrefixExpression": {
      const type = {
        "+": "Positive",
        "-": "Negative"
      }[expr.op];
      if (type === void 0) {
        throw new Error(`Unrecognized PrefixExpression type ${expr.op}`);
      }
      return {
        type,
        arg: childExprToAug(expr.expr)
      };
    }
    case "Norm":
      return {
        type: "Norm",
        arg: childExprToAug(expr.expr)
      };
    case "UpdateRule":
      if (expr.variable.type !== "Identifier") {
        throw Error("Update rule may only assign to a variable");
      }
      return {
        type: "UpdateRule",
        variable: identifierToAug(expr.variable),
        expression: childExprToAug(expr.expr)
      };
    case "SequenceExpression": {
      const seqRight = childExprToAug(expr.right);
      return {
        type: "Seq",
        parenWrapped: expr.parenWrapped,
        args: [
          childExprToAug(expr.left),
          ...seqRight.type === "Seq" && !seqRight.parenWrapped ? seqRight.args : [seqRight]
        ]
      };
    }
    case "MemberExpression":
      return ["x", "y"].includes(expr.property.name) ? {
        type: "OrderedPairAccess",
        point: childExprToAug(expr.object),
        index: expr.property.name
      } : {
        type: "DotAccess",
        object: childExprToAug(expr.object),
        property: identifierToAug(expr.property)
      };
    case "ListAccessExpression":
      return {
        type: "ListAccess",
        list: childExprToAug(expr.expr),
        index: childExprToAug(expr.index)
      };
    case "ComparatorChain":
      return {
        type: "ComparatorChain",
        args: expr.args.map(childExprToAug),
        symbols: expr.symbols
      };
    case "BinaryExpression":
      if (expr.op === "~")
        throw Error("Programming Error: `~` in child BinaryExpression");
      return binopMap2[expr.op] !== void 0 ? {
        type: "BinaryOperator",
        name: binopMap2[expr.op],
        left: childExprToAug(expr.left),
        right: childExprToAug(expr.right)
      } : {
        type: "Comparator",
        operator: expr.op,
        left: childExprToAug(expr.left),
        right: childExprToAug(expr.right)
      };
    case "PostfixExpression":
      return {
        type: "Factorial",
        arg: childExprToAug(expr.expr)
      };
    case "CallExpression":
      if (expr.callee.type === "Identifier" && expr.callee.name === "f_actorial" && expr.arguments.length === 1) {
        return {
          type: "Factorial",
          arg: childExprToAug(expr.arguments[0])
        };
      }
      return callExpressionToAug(expr);
    case "PrimeExpression": {
      const child = callExpressionToAug(expr.expr);
      if (child.type === "DotAccess") {
        throw new Error("Cannot use prime notation together with dot notation");
      }
      return {
        type: "Prime",
        arg: child,
        order: expr.order
      };
    }
    case "DerivativeExpression":
      return {
        type: "Derivative",
        arg: childExprToAug(expr.expr),
        variable: identifierToAug(expr.variable)
      };
    case "AssignmentExpression":
      return assignment(expr);
    default:
      expr;
      throw new Error(
        `Programming Error: Unexpected AST node ${expr.type}`
      );
  }
}
function assignment(e) {
  return {
    type: "AssignmentExpression",
    variable: identifierToAug(e.variable),
    expression: childExprToAug(e.expr)
  };
}
function callExpressionToAug(expr) {
  if (expr.callee.type === "Identifier")
    return {
      type: "FunctionCall",
      callee: identifierToAug(expr.callee),
      args: expr.arguments.map(childExprToAug)
    };
  else if (expr.callee.type === "MemberExpression" && expr.callee.property.type === "Identifier")
    return {
      type: "DotAccess",
      object: childExprToAug(expr.callee.object),
      property: {
        type: "FunctionCall",
        callee: identifierToAug(expr.callee.property),
        args: expr.arguments.map(childExprToAug)
      }
    };
  throw Error("Programming Error: Invalid callee");
}
var binopMap2 = {
  "+": "Add",
  "-": "Subtract",
  "*": "Multiply",
  cross: "CrossMultiply",
  "/": "Divide",
  "^": "Exponent"
};
function piecewiseToAug(branches) {
  if (branches.length === 0) {
    return {
      type: "Piecewise",
      condition: true,
      consequent: constant(1),
      alternate: constant(NaN)
    };
  }
  return piecewiseInnerToAug(branches);
}
function piecewiseInnerToAug(branches) {
  const [firstBranch] = branches;
  if (firstBranch === void 0) return constant(NaN);
  if (firstBranch.condition === null)
    return childExprToAug(firstBranch.consequent);
  const firstCond = childExprToAug(firstBranch.condition);
  if (!isPiecewiseBoolean(firstCond)) {
    throw Error("Invalid condition");
  }
  return {
    type: "Piecewise",
    condition: firstCond,
    consequent: firstBranch.consequent === null ? constant(1) : childExprToAug(firstBranch.consequent),
    alternate: piecewiseInnerToAug(branches.slice(1))
  };
}
function identifierToAug(expr) {
  return {
    type: "Identifier",
    symbol: expr.name
  };
}
function everyNonNull(arr) {
  return arr.every((e) => e !== null);
}

// ../dsm/text-mode-core/down/textToAST.ts
var moo = __toESM(require_moo());
var punct = [
  "<",
  "<=",
  "=",
  ">=",
  ">",
  "~",
  "->",
  ",",
  ":",
  "...",
  ".",
  "'",
  "|",
  "+",
  "-",
  "*",
  "/",
  "^",
  "!",
  "d/d",
  // '% of' TODO
  "@{",
  "#{",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}"
];
var rules = {
  comment: /\/\/[^\n]*/,
  number: /(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/,
  punct: [...punct],
  id: {
    match: /\$\d+|[a-zA-Z][a-zA-Z0-9_]*/,
    type: moo.keywords({
      // prettier-ignore
      keyword: [
        "table",
        "image",
        "settings",
        "folder",
        "ticker",
        "for",
        "integral",
        "sum",
        "product",
        "of",
        "with",
        "cross"
      ]
    })
  },
  string: /"(?:[^"\\]|\\.)*?"/,
  prime: /'+/,
  semi: { match: /;|[ \t\n]*\n[ \t\n]*\n[ \t\n]*/, lineBreaks: true },
  space: { match: /[ \t\n]+/, lineBreaks: true },
  invalid: { match: /[^]/, lineBreaks: true }
};
var _power = [
  "top",
  "meta",
  "seq",
  "rel",
  "sim",
  "updateRule",
  "for",
  "substitution",
  "derivative",
  "add",
  "mul",
  "prefix",
  "pow",
  "postfix",
  "call",
  "access",
  "member"
];
var Power = Object.fromEntries(
  _power.map((k, i) => [k, i * 10])
);
function minus1(bp) {
  return bp - 1;
}
var ParseState = class extends DiagnosticsState {
  constructor(cfg, input, incr) {
    super();
    this.cfg = cfg;
    this.curr = null;
    this.mapIDstmt = {};
    this.currentID = 0;
    this.currentIndex = 0;
    this.lexer = moo.compile(rules);
    this.lexer.reset(input);
    this.rawIDs = [...incr.rawIDs];
    this.rawIDsAll = new Set(incr.rawIDs.map((r) => r.id));
  }
  _next() {
    const t = this.lexer.next();
    this.prevToken = t;
    return t;
  }
  next() {
    while (true) {
      const prev = this.prevToken;
      const t = this._next();
      if (t === void 0)
        return {
          type: "eof",
          value: "",
          offset: prev ? prev.offset + prev.text.length : 0,
          text: "",
          lineBreaks: 0,
          line: prev ? prev.line + prev.lineBreaks : 0,
          col: prev ? prev.col + prev.text.length : 0
        };
      if (t.type === "invalid")
        this.pushError(`Invalid character ${t.value}`, pos(t));
      if (!["space", "invalid", "comment"].includes(t.type)) return t;
    }
  }
  scanToNextStatement() {
    if (this.curr?.type === "semi") return;
    this.curr = null;
    while (true) {
      const t = this._next();
      if (t === void 0 || t.type === "semi") break;
    }
  }
  peek() {
    if (this.curr === null) this.curr = this.next();
    return this.curr;
  }
  _consume() {
    if (this.curr === null) return this.next();
    const c = this.curr;
    this.curr = null;
    return c;
  }
  consume(expected) {
    while (true) {
      const c = this._consume();
      this.assertNotEOF(c);
      if (expected === void 0 || expected === c.value) return c;
      this.pushError(
        `Expected '${expected}' but got '${c.value}'. Skipping it.`,
        pos(c)
      );
    }
  }
  consumeType(expected) {
    if (!Array.isArray(expected)) expected = [expected];
    while (true) {
      const c = this._consume();
      this.assertNotEOF(c);
      if (expected.includes(c.type)) return c;
      this.pushError(
        `Expected ${expected} but got '${c.value}'. Skipping it.`,
        pos(c)
      );
    }
  }
  assertNotEOF(token) {
    if (token.type === "eof")
      throw this.pushFatalError("Unexpected end of file", pos(token));
  }
  pushFatalError(message, pos2) {
    this.pushError(message, pos2);
    return new ParseError(message);
  }
  nextID() {
    while (true) {
      const s = `${++this.currentID}`;
      if (!this.rawIDsAll.has(s)) return s;
    }
  }
  idForRange(pos2) {
    for (let i = 0; i < this.rawIDs.length; i++) {
      const r = this.rawIDs[i];
      if (!r) continue;
      if (r.to >= pos2.from && r.from <= pos2.to) {
        this.rawIDs[i] = void 0;
        return r.id;
      }
    }
  }
  nextIndex() {
    return ++this.currentIndex;
  }
  statementCommon(index, pos2, defaultID) {
    return {
      style: null,
      id: this.idForRange(pos2) ?? defaultID,
      index
    };
  }
  finishStatement(stmt, { index, defaultID } = { index: this.nextIndex(), defaultID: this.nextID() }) {
    const info = this.statementCommon(index, stmt.pos, defaultID);
    Object.assign(stmt, info);
    this.mapIDstmt[info.id] = stmt;
    return stmt;
  }
};
var ParseError = class extends Error {
};
function hydrateIncremental(incr) {
  incr ??= {};
  return {
    rawIDs: incr.rawIDs ?? []
  };
}
function parse(cfg, input, incr) {
  const ps = new ParseState(cfg, input, hydrateIncremental(incr));
  const children = parseStatements(ps, { isTop: true });
  if (children.length === 0 && ps.diagnostics.length === 0)
    ps.pushWarning("Program is empty. Try typing: y=x", { from: 0, to: 0 });
  if (ps.peek().type !== "eof")
    ps.pushError("Didn't reach end", pos(ps.peek()));
  const program = {
    type: "Program",
    children,
    pos: posMany(
      children.map((x) => x.pos),
      { from: 0, to: 0 }
    )
  };
  return {
    diagnostics: ps.diagnostics,
    program,
    mapIDstmt: ps.mapIDstmt
  };
}
function parseMain(ps, lastBindingPower, { isStatementTop } = { isStatementTop: false }) {
  const firstToken = ps.consume();
  const initial = getInitialParselet(firstToken);
  if (!initial)
    throw ps.pushFatalError(
      `Unexpected text: '${firstToken.value}'.`,
      pos(firstToken)
    );
  let leftNode = initial(ps, firstToken);
  while (true) {
    const nextToken = ps.peek();
    const cp = consequentParselets[nextToken.value];
    if (!cp) break;
    if (cp.bindingPower <= lastBindingPower) break;
    ps.consume();
    leftNode = cp.parse(ps, leftNode, nextToken, {
      topLevelEq: isStatementTop && nextToken.value === "="
    });
  }
  return leftNode;
}
function parseExpr(ps, lastBindingPower, posMsg, example) {
  const result = parseMain(ps, lastBindingPower);
  if (!isExpression(result))
    throw ps.pushFatalError(
      `Expected ${posMsg} to be an expression. Did you mean to write something like '${example}'?`,
      pos(result)
    );
  return result;
}
function getInitialParselet(token) {
  const tagGroup = initialParselets[token.type];
  if (typeof tagGroup === "function") return tagGroup;
  else return tagGroup?.[token.value];
}
var initialParselets = {
  punct: {
    "(": (ps, token) => {
      if (ps.peek().value === "d/d") {
        ps.consume();
        const variable = id(ps, ps.consumeType("id"));
        ps.consume(")");
        const expr = parseExpr(
          ps,
          Power.derivative,
          "argument of derivative",
          "(d/d x) x^2"
        );
        return {
          type: "DerivativeExpression",
          expr,
          variable,
          pos: pos(token, expr)
        };
      }
      const inner = parseMain(ps, Power.top);
      const closeParen = ps.consume(")");
      if (inner.type === "SequenceExpression") {
        return {
          ...inner,
          parenWrapped: true,
          pos: pos(token, closeParen)
        };
      }
      return {
        ...inner,
        pos: pos(token, closeParen)
      };
    },
    "|": (ps, token) => {
      const inner = parseExpr(ps, Power.top, "Argument of norm", "|x|");
      const closeAbs = ps.consume("|");
      return {
        type: "Norm",
        expr: inner,
        pos: pos(token, closeAbs)
      };
    },
    "-": (ps, token) => {
      const bp = Power.prefix;
      const expr = parseExpr(ps, bp, "Argument of negative", "-x");
      return {
        type: "PrefixExpression",
        op: "-",
        expr,
        pos: pos(token, expr)
      };
    },
    "+": (ps, token) => {
      const bp = Power.prefix;
      const expr = parseExpr(ps, bp, "Argument of positive", "+x");
      return {
        type: "PrefixExpression",
        op: "+",
        expr,
        pos: pos(token, expr)
      };
    },
    "[": parseList,
    "{": (ps, token) => {
      const branches = [];
      const next = ps.peek();
      if (next.value === "}") {
        const next2 = ps.consume();
        return finalizePiecewise(branches, pos(token, next2));
      }
      while (true) {
        const curr = parseExpr(
          ps,
          Power.seq,
          "condition of piecewise",
          "{x>3}"
        );
        const next2 = ps.consume();
        if (next2.value === "}") {
          const first = branches.length === 0;
          if (first) assertComparison(ps, curr);
          branches.push(
            first || isComparison(curr) ? {
              type: "PiecewiseBranch",
              condition: curr,
              consequent: null,
              pos: pos(curr)
            } : {
              type: "PiecewiseBranch",
              condition: null,
              consequent: curr,
              pos: pos(curr)
            }
          );
          return finalizePiecewise(branches, pos(token, next2));
        } else if (next2.value === ":") {
          const consequent = parseExpr(
            ps,
            Power.seq,
            "branch of piecewise",
            "{x>3:5}"
          );
          assertComparison(ps, curr);
          branches.push({
            type: "PiecewiseBranch",
            condition: curr,
            consequent,
            pos: pos(curr, consequent)
          });
          const next3 = ps.consume();
          if (next3.value === "}")
            return finalizePiecewise(branches, pos(token, next3));
          else if (next3.value !== ",")
            throw ps.pushFatalError(
              "Unexpected character in Piecewise",
              pos(next3)
            );
        } else if (next2.value === ",") {
          assertComparison(ps, curr);
          branches.push({
            type: "PiecewiseBranch",
            condition: curr,
            consequent: null,
            pos: pos(curr)
          });
        } else {
          throw ps.pushFatalError(
            "Unexpected character in Piecewise",
            pos(next2)
          );
        }
      }
    },
    "@{": parseStyleMapping
  },
  number: (_, token) => ({
    type: "Number",
    value: parseFloat(token.value),
    pos: pos(token)
  }),
  id: (ps, token) => id(ps, token),
  string: stringParselet,
  keyword: {
    sum: repeatedOperatorParselet("sum"),
    product: repeatedOperatorParselet("product"),
    integral: repeatedOperatorParselet("integral"),
    table: (ps, token) => {
      const index = ps.nextIndex();
      const defaultID = ps.nextID();
      const open = ps.consume("{");
      const columns = parseStatements(ps).flatMap((stmt) => {
        if (stmt.type !== "ExprStatement") {
          ps.pushError(
            "Expected a valid table column. Try: x1 = [1, 2, 3]",
            stmt.pos
          );
          return [];
        } else return [stmt];
      });
      const end = ps.consume("}");
      return ps.finishStatement(
        {
          type: "Table",
          columns,
          pos: pos(token, end),
          afterOpen: pos(open).to
        },
        { index, defaultID }
      );
    },
    folder: (ps, token) => {
      const index = ps.nextIndex();
      const defaultID = ps.nextID();
      const title = stringParselet(ps, ps.consumeType("string"));
      const open = ps.consume("{");
      const children = parseStatements(ps);
      const end = ps.consume("}");
      return ps.finishStatement(
        {
          type: "Folder",
          children,
          title: title.value,
          pos: pos(token, end),
          afterOpen: pos(open).to
        },
        { index, defaultID }
      );
    },
    image: (ps, token) => {
      const name = stringParselet(ps, ps.consumeType("string"));
      return ps.finishStatement({
        type: "Image",
        name: name.value,
        pos: pos(token, name)
      });
    },
    settings: (ps, token) => ps.finishStatement({
      type: "Settings",
      pos: pos(token)
    }),
    ticker: (ps, token) => {
      const handler = parseExpr(ps, Power.meta, "ticker handler", "a -> a+1");
      return ps.finishStatement({
        type: "Ticker",
        handler,
        pos: pos(token, handler)
      });
    }
  }
};
function finalizePiecewise(branches, piecewisePos) {
  if (branches.every((b) => b.consequent === null)) {
    if (branches.length === 0)
      return { type: "Restriction", condition: true, pos: piecewisePos };
    const condition = branches.map((b) => b.condition).reduceRight(
      (right, left) => ({
        type: "Or",
        left,
        right,
        pos: pos(left, right)
      })
    );
    return { type: "Restriction", condition, pos: piecewisePos };
  }
  return {
    type: "PiecewiseExpression",
    branches,
    pos: piecewisePos
  };
}
function isComparisonOp(op) {
  return ["<", ">", "<=", ">=", "="].includes(op);
}
function assertComparison(ps, node) {
  if (!isComparison(node))
    throw ps.pushFatalError("Condition must be a comparison", node.pos);
}
function isComparison(node) {
  return node.type === "ComparatorChain" || node.type === "BinaryExpression" && isComparisonOp(node.op);
}
function id(ps, token) {
  return {
    type: "Identifier",
    name: normalizeID(ps, token),
    pos: pos(token)
  };
}
function normalizeID(ps, token) {
  const error2 = (msg) => {
    ps.pushError(msg, pos(token));
    return "error";
  };
  if (/^\$\d+$/.test(token.value)) return token.value;
  const parts = token.value.split("_");
  if (parts.length === 1) {
    const [p] = parts;
    if (p.length === 1 || ps.cfg.commandNames.has(p) || ps.cfg.operatorNames.has(p))
      return p;
    return p[0] + "_" + p.slice(1);
  } else if (parts.length === 2) {
    const [main, subscript] = parts;
    if (subscript.length === 0) return error2("Cannot end with '_'");
    if (/[0-9]/.test(main)) return error2("Digits are not allowed before '_'");
    return main + "_" + subscript;
  } else {
    return error2("Too many '_' in identifier");
  }
}
function parseStatements(ps, { isTop } = { isTop: false }) {
  const out = [];
  while (true) {
    let next = ps.peek();
    while (next.type === "semi") {
      ps.consume();
      next = ps.peek();
    }
    if (isTop && next.value === "}") {
      ps.pushError("Unexpected '}'", pos(next));
      ps.consume();
      continue;
    }
    if (next.value === "}" || next.type === "eof") return out;
    try {
      const stmt = parseMain(ps, Power.top, { isStatementTop: true });
      out.push(finalizeStatement(ps, stmt));
      const next2 = ps.peek();
      if (next2.value === "}" || next2.type === "eof") return out;
      ps.consumeType("semi");
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      ps.scanToNextStatement();
    }
  }
}
function stringParselet(_ps, token) {
  return {
    type: "String",
    value: JSON.parse(token.value),
    pos: pos(token)
  };
}
function repeatedOperatorParselet(name) {
  const ex = `(${name}=(1...5) x^2)`;
  return (ps, token) => {
    const index = id(ps, ps.consumeType("id"));
    ps.consume("=");
    ps.consume("(");
    const start = parseExpr(ps, Power.top, `lower bound of ${name}`, ex);
    ps.consume("...");
    const end = parseExpr(ps, Power.top, `Upper bound of ${name}`, ex);
    ps.consume(")");
    const expr = parseExpr(ps, Power.add, `Term expression of ${name}`, ex);
    return {
      type: "RepeatedExpression",
      name,
      index,
      start,
      end,
      expr,
      pos: pos(token, expr)
    };
  };
}
var consequentParselets = {
  "+": binaryParselet(Power.add, "+"),
  "-": binaryParselet(Power.add, "-"),
  "*": binaryParselet(Power.mul, "*"),
  cross: binaryParselet(Power.mul, "cross"),
  "/": binaryParselet(Power.mul, "/"),
  "^": binaryParselet(Power.pow, "^", { rightAssociative: true }),
  "(": consequentParselet(Power.call, parseFunctionCall),
  "'": consequentParselet(Power.call, (ps, left) => {
    if (left.type !== "Identifier")
      throw ps.pushFatalError(
        "Cannot use prime notation on a non-identifier",
        pos(left)
      );
    let order = 1;
    while (true) {
      const next = ps.consume();
      if (next.value === "'") order++;
      else if (next.value === "(") {
        const expr = parseFunctionCall(ps, left);
        return {
          type: "PrimeExpression",
          expr,
          order,
          pos: pos(left, expr)
        };
      } else {
        throw ps.pushFatalError("Expected '('", pos(next));
      }
    }
  }),
  "!": consequentParselet(Power.postfix, (ps, left, token) => {
    assertLeftIsExpression(ps, left, token, "x!");
    return {
      type: "PostfixExpression",
      op: "factorial",
      expr: left,
      pos: pos(left, token)
    };
  }),
  ".": consequentParselet(Power.member, (ps, left, token) => {
    assertLeftIsExpression(ps, left, token, "(2,3).x");
    const right = parseMain(ps, Power.member);
    if (right.type !== "Identifier")
      throw ps.pushFatalError(
        `Member access name must be an identifier but got ${right.type}`,
        pos(token)
      );
    return {
      type: "MemberExpression",
      object: left,
      property: right,
      pos: pos(left, right)
    };
  }),
  "[": consequentParselet(Power.access, (ps, left, token) => {
    assertLeftIsExpression(ps, left, token, "L[L>5]");
    const right = parseList(ps, token);
    return {
      type: "ListAccessExpression",
      expr: left,
      index: right.type === "ListExpression" && right.values.length === 1 ? right.values[0] : right,
      pos: pos(left, right)
    };
  }),
  "<": compareOpParselet("<"),
  "<=": compareOpParselet("<="),
  "=": compareOpParselet("="),
  ">=": compareOpParselet(">="),
  ">": compareOpParselet(">"),
  "->": consequentParselet(Power.updateRule, (ps, left) => {
    if (left.type !== "Identifier")
      throw ps.pushFatalError(
        `Left side of update rule must be Identifier, but got ${left.type}`,
        pos(left)
      );
    const right = parseExpr(
      ps,
      Power.updateRule,
      "right side of action update rule",
      "a -> a+1"
    );
    return {
      type: "UpdateRule",
      variable: left,
      expr: right,
      pos: pos(left, right)
    };
  }),
  ",": consequentParselet(Power.seq, (ps, left, token) => {
    const ex = "a -> a+b, b -> a";
    assertLeftIsExpression(ps, left, token, ex);
    if (ps.peek().value === "...") return left;
    const right = parseExpr(ps, minus1(Power.seq), "right side of ','", ex);
    return {
      type: "SequenceExpression",
      left,
      right,
      pos: pos(left, right),
      parenWrapped: false
    };
  }),
  "@{": consequentParselet(Power.meta, (ps, left, token) => {
    const stmt = finalizeStatement(ps, left);
    const style = parseStyleMapping(ps, token);
    const stmt2 = {
      ...stmt,
      id: getIDOverride(ps, style) ?? stmt.id,
      style,
      pos: pos(stmt, style)
    };
    delete ps.mapIDstmt[stmt.id];
    ps.mapIDstmt[stmt2.id] = stmt2;
    return stmt2;
  }),
  "~": consequentParselet(Power.sim, (ps, left, token) => {
    const ex = "y1 ~ m * x1 + b";
    assertLeftIsExpression(ps, left, token, ex);
    const right = parseExpr(ps, Power.sim, "Right side of '~", ex);
    return {
      type: "BinaryExpression",
      op: "~",
      left,
      right,
      pos: pos(left, right)
    };
  }),
  "#{": consequentParselet(Power.meta, (ps, left, token) => {
    if (!isStatement(left)) left = finalizeStatement(ps, left);
    if (left.type !== "ExprStatement" || left.expr.type !== "BinaryExpression" || left.expr.op !== "~")
      throw ps.pushFatalError(
        "Regression Parameters '#{' must be preceded by a regression of the form `LHS ~ RHS`",
        pos(token)
      );
    const seq = parseBareSeq(ps, "y1 ~ m * x1 + b #{ m = 1.5, b = 2.3 }");
    const end = ps.consume("}");
    const entries = seq.map((expr) => {
      if (expr.type !== "BinaryExpression" || expr.op !== "=" || expr.left.type !== "Identifier")
        throw ps.pushFatalError(
          "Regression mapping entry must be of the form 'name = 123'",
          pos(expr)
        );
      return {
        type: "RegressionEntry",
        variable: expr.left,
        value: expr.right,
        pos: pos(expr)
      };
    });
    const parameters = {
      type: "RegressionParameters",
      entries,
      pos: pos(token, end)
    };
    return {
      ...left,
      parameters,
      pos: pos(left, parameters)
    };
  }),
  with: consequentParselet(Power.substitution, (ps, left, token) => {
    assertLeftIsExpression(ps, left, token, "f(x) with a=3");
    const assignments = parseBareSeq(ps, "f(x) with a=3,b=[1...5]").map(
      (item) => {
        if (item.type !== "BinaryExpression" || item.op !== "=" || item.left.type !== "Identifier")
          throw ps.pushFatalError(
            "Substitution must set variable = identifier",
            pos(item)
          );
        return {
          type: "AssignmentExpression",
          variable: item.left,
          expr: item.right,
          pos: item.pos
        };
      }
    );
    return {
      type: "Substitution",
      body: left,
      assignments,
      pos: pos(left, assignments[assignments.length - 1])
    };
  }),
  for: consequentParselet(Power.for, (ps, left, token) => {
    assertLeftIsExpression(ps, left, token, "(a,a^2) for 1<a<2");
    const assignments = [];
    const parameters = [];
    let last = null;
    for (const item of parseBareSeq(ps, "[a+b for a=[0,5,10],b=[1...5]]")) {
      if (item.type === "BinaryExpression" && item.op === "=" && item.left.type === "Identifier") {
        last = {
          type: "AssignmentExpression",
          variable: item.left,
          expr: item.right,
          pos: item.pos
        };
        assignments.push(last);
      } else if (item.type === "ComparatorChain" && item.symbols.length === 2 && item.symbols.every((s) => s === "<" || s === "<=") && item.args[1].type === "Identifier") {
        [, , last] = item.args;
        parameters.push({
          identifier: item.args[1],
          open: [item.symbols[0] === "<", item.symbols[1] === "<"],
          bounds: [item.args[0], item.args[2]]
        });
      } else {
        throw ps.pushFatalError(
          "List comprehension must set variable = identifier",
          pos(item)
        );
      }
    }
    if (last === null)
      throw ps.pushFatalError("Missing an assignment after 'for'", pos(token));
    return {
      type: "ListComprehension",
      expr: left,
      assignments,
      parameters,
      bracketWrapped: false,
      pos: pos(left, last)
    };
  }),
  "...": void 0,
  "]": void 0,
  "{": void 0,
  "}": void 0,
  ":": void 0,
  "d/d": void 0,
  ")": void 0,
  "|": void 0
};
function parseList(ps, token) {
  const startValues = parseBareSeq(ps, "[1,2,3]");
  const next = ps.consume();
  if (next.value === "...") {
    if (ps.peek().value === ",") ps.consume();
    const endValues = parseBareSeq(ps, "[1,11,...,81,91]");
    const t = ps.consume("]");
    return {
      type: "RangeExpression",
      startValues,
      endValues,
      pos: pos(token, t)
    };
  } else if (next.value === "]") {
    const listcomps = startValues.filter((e) => e.type === "ListComprehension");
    if (listcomps.length > 0) {
      const [inner] = startValues;
      if (listcomps.length > 1)
        throw ps.pushFatalError(
          "List comprehension can only have one 'for'",
          pos(startValues[1])
        );
      if (inner.type !== "ListComprehension")
        throw ps.pushFatalError(
          "Expected exactly one expression before 'for'",
          pos(next)
        );
      if (!inner.bracketWrapped) {
        return {
          ...inner,
          bracketWrapped: true
        };
      }
    }
    return {
      type: "ListExpression",
      values: startValues,
      pos: pos(token, next)
    };
  } else {
    throw ps.pushFatalError("Expected ']'", pos(next));
  }
}
function getIDOverride(ps, style) {
  let cnt = 0;
  let id2;
  for (const {
    property: { value: key },
    expr
  } of style.entries) {
    if (key === "id") {
      cnt++;
      if (cnt > 1) {
        ps.pushError("Duplicate id field", expr.pos);
      } else if (expr.type === "String") {
        if (ignoredID(expr.value)) {
          if (expr.value.startsWith("__"))
            ps.pushError(`Specified id must not start with '__'`, expr.pos);
          else
            ps.pushError(
              `Specified id must include a character other than a digit`,
              expr.pos
            );
        } else {
          id2 = expr.value;
        }
      } else {
        ps.pushError(
          `Expected id to be a string, but got ${expr.type}`,
          expr.pos
        );
      }
    }
  }
  if (cnt === 1) return id2;
}
function parseStyleMapping(ps, token) {
  const entries = [];
  while (true) {
    if (ps.peek().value === "}") {
      const close = ps.consume();
      return {
        type: "StyleMapping",
        entries,
        pos: pos(token, close)
      };
    }
    const key = ps.consumeType(["id", "keyword"]);
    ps.consume(":");
    const expr = parseMain(ps, Power.seq);
    if (!isExpression(expr) && expr.type !== "StyleMapping")
      throw ps.pushFatalError("Expected value on the right of ':'", pos(expr));
    entries.push({
      type: "MappingEntry",
      property: {
        type: "String",
        value: key.value,
        pos: pos(key)
      },
      expr,
      pos: pos(key, expr)
    });
    if (ps.peek().value !== "}") ps.consume(",");
  }
}
function finalizeStatement(ps, expr) {
  if (isStatement(expr)) return expr;
  else if (isExpression(expr)) return exprToStatement(ps, expr);
  else
    throw ps.pushFatalError(
      `I don't know how to finalize '${expr.type}'`,
      pos(expr)
    );
}
function exprToStatement(ps, expr) {
  if (expr.type === "String")
    return ps.finishStatement({
      type: "Text",
      text: expr.value,
      pos: expr.pos
    });
  let residualVariable;
  if (expr.type === "BinaryExpression" && expr.op === "=" && expr.right.type === "BinaryExpression" && expr.right.op === "~") {
    const { left } = expr;
    if (left.type !== "Identifier") {
      throw ps.pushFatalError(
        `Residual variable must be identifier, but got ${left.type}`,
        pos(left)
      );
    }
    expr = expr.right;
    residualVariable = left;
  }
  const isRegression = expr.type === "BinaryExpression" && expr.op === "~";
  return ps.finishStatement({
    type: "ExprStatement",
    expr,
    pos: isRegression && residualVariable ? pos(residualVariable, expr) : pos(expr),
    parameters: void 0,
    residualVariable: isRegression ? residualVariable : void 0
  });
}
function parseBareSeq(ps, example) {
  const out = [];
  while (true) {
    const peek = ps.peek();
    if (peek.value === "]" || peek.value === "...") break;
    const item = parseExpr(ps, Power.seq, `item in sequence`, example);
    out.push(item);
    const next = ps.peek();
    if (next.value !== ",") break;
    ps.consume();
  }
  return out;
}
function parseFunctionCall(ps, left) {
  const args = ps.peek().value === ")" ? [] : parseBareSeq(ps, "f(x,y)");
  const next = ps.consume(")");
  if (left.type !== "Identifier" && left.type !== "MemberExpression")
    throw ps.pushFatalError("Function call must be an identifier", pos(left));
  return {
    type: "CallExpression",
    callee: left,
    arguments: args,
    pos: pos(left, next)
  };
}
function extendComparison(ps, left, op, opToken, right) {
  if (left.type === "ComparatorChain") {
    const leftSymbol = left.symbols.at(-1);
    if (relopDir(leftSymbol) !== relopDir(op)) {
      throw ps.pushFatalError(
        `Cannot chain ${leftSymbol} with ${op}`,
        pos(opToken)
      );
    }
    return {
      type: "ComparatorChain",
      args: [...left.args, right],
      symbols: [...left.symbols, op],
      pos: pos(left, right)
    };
  } else if (left.type === "BinaryExpression" && isComparisonOp(left.op)) {
    if (relopDir(left.op) !== relopDir(op)) {
      throw ps.pushFatalError(
        `Cannot chain ${left.op} with ${op}`,
        pos(opToken)
      );
    }
    return {
      type: "ComparatorChain",
      args: [left.left, left.right, right],
      symbols: [left.op, op],
      pos: pos(left, right)
    };
  } else {
    return {
      type: "BinaryExpression",
      left,
      right,
      op,
      pos: pos(left, right)
    };
  }
}
function compareOpParselet(op) {
  return consequentParselet(Power.rel, (ps, left, token, opts) => {
    const ex = `y ${op} x`;
    assertLeftIsExpression(ps, left, token, ex);
    const rightPrec = opts.topLevelEq ? minus1(Power.seq) : Power.rel;
    const right = parseExpr(ps, rightPrec, "right side of comparison", ex);
    return extendComparison(ps, left, op, token, right);
  });
}
function relopDir(symbol) {
  return symbol === "=" ? 0 : symbol.startsWith("<") ? 1 : -1;
}
function consequentParselet(bindingPower, parse2) {
  return { bindingPower, parse: parse2 };
}
function binaryParselet(bp, op, { rightAssociative } = {}) {
  return consequentParselet(bp, (ps, left, token) => {
    const ex = op === "cross" ? `v ${op} u` : `2 ${op} x`;
    assertLeftIsExpression(ps, left, token, ex);
    const right = parseExpr(
      ps,
      rightAssociative ?? false ? minus1(bp) : bp,
      `right side of ${op}`,
      ex
    );
    return {
      type: "BinaryExpression",
      op,
      left,
      right,
      pos: pos(left, right)
    };
  });
}
function assertLeftIsExpression(ps, node, posToken, example) {
  if (!isExpression(node))
    throw ps.pushFatalError(
      `Unexpected '${posToken.value}'. Did you mean to precede it by an expression, such as '${example}'?`,
      pos(posToken)
    );
}
function pos(start, end = start) {
  return {
    from: "pos" in start ? start.pos.from : start.offset,
    to: "pos" in end ? end.pos.to : end.offset + end.text.length
  };
}
function posMany(arr, initial) {
  return arr.reduce(
    (a, b) => ({ from: Math.min(a.from, b.from), to: Math.max(a.to, b.to) }),
    initial
  );
}

// ../dsm/text-mode-core/down/textToRaw.ts
function textToRaw(cfg, text3, incr) {
  const analysis = parse(cfg, text3, incr);
  try {
    const [analysis2, aug] = astToAug(cfg, analysis);
    return [analysis2, aug ? augToRaw(cfg, aug) : null];
  } catch (err) {
    console.warn("Error while compiling to Desmos:\n", err);
    return [
      {
        diagnostics: [error(`Fatal error: ${err}`, void 0)],
        program: analysis.program,
        mapIDstmt: {}
      },
      null
    ];
  }
}
function textModeExprToLatex(cfg, tmExpr) {
  const parsedTextMode = parse(cfg, tmExpr);
  if (parsedTextMode.program.children.length !== 1 || parsedTextMode.diagnostics.length > 0)
    return;
  const [parsedExpr] = parsedTextMode.program.children;
  if (parsedExpr && parsedExpr.type === "ExprStatement") {
    const aug = childExprToAug(parsedExpr.expr);
    const latex = latexTreeToString(cfg, aug);
    return latex;
  }
}

// ../dsm/metadata/migrations/migrate1to2.ts
function migrate1to2(state) {
  const stateOut = {
    version: 2,
    expressions: {}
  };
  for (const pinnedID of state.pinnedExpressions ?? []) {
    stateOut.expressions[pinnedID] = {
      pinned: true
    };
  }
  return stateOut;
}

// ../dsm/metadata/migrate.ts
function migrateToLatest(metadata) {
  return migrateToLatestMaybe(metadata) ?? getBlankMetadata();
}
function migrateToLatestMaybe(metadata) {
  if ("pinnedExpressions" in metadata) {
    metadata = migrate1to2(metadata);
  }
  if (metadata.version !== 2) {
    return void 0;
  }
  if (!("expressions" in metadata) || typeof metadata.expressions !== "object") {
    return void 0;
  }
  return metadata;
}

// ../dsm/parsing/parsenode.ts
function evalMaybeRational(x) {
  if (typeof x === "number") {
    return x;
  } else {
    return x.n / x.d;
  }
}

// ../dsm/text-mode-core/aug/rawToAug.ts
function rawToAug(cfg, raw) {
  const dsmMetadata = rawToDsmMetadata(raw);
  const res = {
    version: 9,
    settings: rawToAugSettings(raw),
    expressions: {
      list: rawListToAug(cfg, raw.expressions.list, dsmMetadata)
    }
  };
  const { ticker: ticker3 } = raw.expressions;
  if (ticker3?.handlerLatex) {
    res.expressions.ticker = {
      handlerLatex: parseLatex(cfg, ticker3.handlerLatex),
      minStepLatex: parseLatex(cfg, ticker3.minStepLatex ?? "0"),
      playing: ticker3.playing ?? false
    };
  }
  return res;
}
function rawToAugSettings(raw) {
  return {
    ...raw.graph,
    randomSeed: raw.randomSeed
  };
}
function rawToDsmMetadata(raw) {
  const dsmMetadataExpr = raw.expressions.list.find(
    (e) => e.id === ID_METADATA
  );
  return migrateToLatest(
    dsmMetadataExpr?.type === "text" ? JSON.parse(dsmMetadataExpr.text ?? "{}") : {}
  );
}
function rawListToAug(cfg, list, dsmMetadata) {
  const res = [];
  let currentFolder = null;
  for (const item of list) {
    if (item.id === ID_METADATA_FOLDER || item.id === ID_METADATA) {
      continue;
    }
    if (item.type === "folder") {
      currentFolder = rawFolderToAug(item);
      res.push(currentFolder);
    } else {
      const augItem = rawNonFolderToAug(cfg, item, dsmMetadata);
      if (item.folderId) {
        if (!currentFolder || item.folderId !== currentFolder.id) {
          throw Error("Folder ID inconsistent");
        }
        currentFolder.children.push(augItem);
      } else {
        res.push(augItem);
      }
    }
  }
  return res;
}
function rawFolderToAug(item) {
  return {
    type: "folder",
    id: item.id,
    secret: item.secret ?? false,
    hidden: item.hidden ?? false,
    collapsed: item.collapsed ?? false,
    title: item.title ?? "",
    children: []
  };
}
function rawNonFolderToAug(cfg, item, dsmMetadata) {
  try {
    return tryRawNonFolderToAug(cfg, item, dsmMetadata);
  } catch {
    return {
      id: item.id,
      secret: false,
      pinned: false,
      type: "text",
      text: item.type,
      error: true
    };
  }
}
function tryRawNonFolderToAug(cfg, item, dsmMetadata) {
  const base2 = {
    id: item.id,
    pinned: dsmMetadata.expressions[item.id]?.pinned ?? false,
    secret: item.secret ?? false
  };
  switch (item.type) {
    case "expression": {
      let latex;
      if (item.latex) {
        try {
          latex = parseRootLatex(cfg, item.latex);
        } catch {
          return {
            ...base2,
            type: "text",
            text: item.latex,
            error: true
          };
        }
      }
      return {
        ...base2,
        type: "expression",
        ...columnExpressionCommon4(cfg, item),
        ...latex ? { latex } : {},
        ...item.labelSize !== "0" && item.label && item.showLabel ? {
          label: {
            text: item.label,
            size: parseLatex(cfg, item.labelSize ?? "1"),
            orientation: item.labelOrientation ?? "default",
            angle: parseLatex(cfg, item.labelAngle ?? "0"),
            outline: !item.suppressTextOutline,
            showOnHover: item.interactiveLabel ?? false,
            editableMode: item.editableLabelMode ?? "NONE"
          }
        } : {},
        fillOpacity: item.fill === false ? parseLatex(cfg, "0") : parseMaybeLatex(
          cfg,
          item.fillOpacity === "0" ? "2^{-99}" : item.fillOpacity ?? (item.fill ? "0.4" : void 0)
        ),
        regression: item.residualVariable ? {
          residualVariable: parseLatex(
            cfg,
            item.residualVariable
          ),
          regressionParameters: new Map(
            Object.entries(item.regressionParameters ?? {}).map(
              ([key, value]) => [
                parseLatex(cfg, key),
                value
              ]
            )
          ),
          isLogMode: !!item.isLogModeRegression
        } : void 0,
        slider: {
          period: item.slider?.animationPeriod,
          loopMode: item.slider?.loopMode,
          playDirection: item.slider?.playDirection,
          isPlaying: item.slider?.isPlaying,
          min: item.slider?.min ? parseLatex(cfg, item.slider?.min) : void 0,
          max: item.slider?.max ? parseLatex(cfg, item.slider?.max) : void 0,
          step: item.slider?.step ? parseLatex(cfg, item.slider?.step) : void 0
        },
        glesmos: dsmMetadata.expressions[item.id]?.glesmos ?? false,
        errorHidden: dsmMetadata.expressions[item.id]?.errorHidden ?? false,
        fractionDisplay: item.displayEvaluationAsFraction ?? false,
        polarDomain: parseMapDomain(cfg, item.polarDomain, "0", "12\\pi"),
        parametricDomain: parseMapDomain(cfg, item.parametricDomain),
        parametricDomain3Du: parseMapDomain(cfg, item.parametricDomain3Du),
        parametricDomain3Dv: parseMapDomain(cfg, item.parametricDomain3Dv),
        parametricDomain3Dr: parseMapDomain(cfg, item.parametricDomain3Dr),
        parametricDomain3Dphi: parseMapDomain(cfg, item.parametricDomain3Dphi),
        cdf: item.cdf?.show ? {
          min: item.cdf.min ? parseLatex(cfg, item.cdf.min) : void 0,
          max: item.cdf.max ? parseLatex(cfg, item.cdf.max) : void 0
        } : void 0,
        vizProps: vizPropsAug(cfg, item),
        clickableInfo: item.clickableInfo?.latex ? {
          description: item.clickableInfo.description ?? "",
          latex: parseLatex(cfg, item.clickableInfo.latex)
        } : void 0
      };
    }
    case "image":
      return {
        ...base2,
        type: "image",
        image_url: item.image_url,
        name: item.name ?? "",
        width: parseLatex(cfg, item.width ?? "10"),
        // The height is not actually 10 by default
        height: parseLatex(cfg, item.height ?? "10"),
        center: parseLatex(cfg, item.center ?? "(0,0)"),
        angle: parseLatex(cfg, item.angle ?? "0"),
        // opacity = 0 corresponds to hidden: true
        opacity: parseLatex(cfg, item.hidden ? "0" : item.opacity ?? "1"),
        foreground: item.foreground ?? false,
        draggable: item.draggable ?? false,
        clickableInfo: item.clickableInfo?.latex ? {
          description: item.clickableInfo.description ?? "",
          latex: parseLatex(cfg, item.clickableInfo.latex),
          hoveredImage: item.clickableInfo.hoveredImage,
          depressedImage: item.clickableInfo.depressedImage
        } : void 0
      };
    case "table": {
      const longestColumnLength = Math.max(
        ...item.columns.map(
          (col) => (col.values ?? []).map((e) => e !== "").lastIndexOf(true)
        )
      );
      return {
        ...base2,
        type: "table",
        columns: item.columns.filter((column3) => column3.latex !== void 0).map((column3) => ({
          type: "column",
          id: column3.id,
          values: (column3.values ?? []).slice(0, longestColumnLength + 1).map((s) => parseLatex(cfg, s)),
          ...columnExpressionCommon4(cfg, column3),
          latex: parseLatex(cfg, column3.latex)
        }))
      };
    }
    case "text":
      return {
        ...base2,
        type: "text",
        text: item.text ?? ""
      };
  }
}
function vizPropsAug(cfg, item) {
  const viz = item.vizProps ?? {};
  if (!viz) return {};
  const res = {
    dotplotMode: viz.dotplotXMode,
    binAlignment: viz.binAlignment,
    histogramMode: viz.histogramMode
  };
  if (viz.breadth ?? viz.axisOffset ?? viz.alignedAxis ?? viz.showBoxplotOutliers) {
    res.boxplot = {
      breadth: parseLatex(cfg, viz.breadth ?? "1"),
      axisOffset: parseLatex(cfg, viz.axisOffset ?? "1"),
      alignedAxis: viz.alignedAxis ?? "x",
      showOutliers: viz.showBoxplotOutliers ?? false
    };
  }
  return res;
}
function parseMapDomain(cfg, domain2, fallbackMin = "0", fallbackMax = "1") {
  if (!domain2) return void 0;
  return {
    min: parseLatex(cfg, domain2.min || fallbackMin),
    max: parseLatex(cfg, domain2.max || fallbackMax)
  };
}
function columnExpressionCommon4(cfg, item) {
  const color = item.colorLatex ? parseLatex(cfg, item.colorLatex) : item.color;
  return {
    color,
    hidden: item.hidden ?? false,
    points: item.points === false || item.pointOpacity === "0" || item.pointSize === "0" ? { size: parseLatex(cfg, "0") } : item.points === true || item.pointOpacity !== void 0 || item.pointSize !== void 0 || item.dragMode !== void 0 ? {
      opacity: parseMaybeLatex(cfg, item.pointOpacity),
      size: parseMaybeLatex(cfg, item.pointSize),
      style: item.pointStyle,
      dragMode: item.dragMode
    } : void 0,
    lines: item.lines === false || item.lineOpacity === "0" || item.lineWidth === "0" ? { width: parseLatex(cfg, "0") } : item.lines === true || item.lineOpacity !== void 0 || item.lineWidth !== void 0 ? {
      opacity: parseMaybeLatex(cfg, item.lineOpacity),
      width: parseMaybeLatex(cfg, item.lineWidth),
      style: item.lineStyle
    } : void 0
  };
}
function parseMaybeLatex(cfg, str) {
  return str !== void 0 ? parseLatex(cfg, str) : void 0;
}
function parseLatex(cfg, str) {
  if (str === "") return { type: "Constant", value: NaN };
  const res = cfg.parseDesmosLatex(str);
  return childNodeToTree(res);
}
function parseRootLatex(cfg, str) {
  const parsed = cfg.parseDesmosLatex(str);
  switch (parsed.type) {
    case "Equation":
      return {
        type: "Equation",
        left: childNodeToTree(parsed._lhs),
        right: childNodeToTree(parsed._rhs)
      };
    case "Assignment":
      return {
        type: "Assignment",
        left: parseIdentifier(parsed._symbol),
        right: childNodeToTree(parsed._expression)
      };
    case "FunctionDefinition":
      return {
        type: "FunctionDefinition",
        symbol: parseIdentifier(parsed._symbol),
        argSymbols: parsed._argSymbols.map(parseIdentifier),
        definition: childNodeToTree(parsed._expression)
      };
    case "Stats":
    case "BoxPlot":
    case "DotPlot":
    case "Histogram":
    case "IndependentTTest":
    case "TTest":
      return {
        type: "Visualization",
        callee: {
          type: "Identifier",
          symbol: vizSymbol[parsed.type]
        },
        args: parsed.args.map(childNodeToTree)
      };
    case "Regression":
      return {
        type: "Regression",
        left: childNodeToTree(parsed._lhs),
        right: childNodeToTree(parsed._rhs)
      };
    default:
      return childNodeToTree(parsed);
  }
}
var vizSymbol = {
  Stats: "stats",
  BoxPlot: "boxplot",
  DotPlot: "dotplot",
  Histogram: "histogram",
  IndependentTTest: "IndependentTTest",
  TTest: "TTest"
};
function childNodeToTree(node) {
  switch (node.type) {
    case "Constant":
    case "MixedNumber":
      if (typeof node._constantValue === "boolean") {
        throw Error(
          "Constant value is boolean, but expected rational or number"
        );
      }
      return {
        type: "Constant",
        value: evalMaybeRational(node._constantValue)
      };
    case "Identifier":
      return parseIdentifier(node._symbol);
    case "Norm":
      return {
        type: "Norm",
        arg: childNodeToTree(node.args[0])
      };
    case "FunctionCall":
      if (node._symbol === "factorial" && node.args.length === 1)
        return { type: "Factorial", arg: childNodeToTree(node.args[0]) };
      return {
        type: "FunctionCall",
        callee: parseIdentifier(node._symbol),
        args: node.args.map(childNodeToTree)
      };
    case "SeededFunctionCall":
      return {
        type: "FunctionCall",
        callee: parseIdentifier(node._symbol),
        // exclude the seed
        args: node.args.filter((e) => e.type !== "ExtendSeed").map((e) => childNodeToTree(e))
      };
    case "Seed":
    case "ExtendSeed":
      throw Error(`Programming error: ${node.type} encountered`);
    case "FunctionExponent":
      return {
        type: "BinaryOperator",
        name: "Exponent",
        left: {
          type: "FunctionCall",
          callee: nodeToIdentifier(node.args[0]),
          args: [childNodeToTree(node.args[1])]
        },
        right: childNodeToTree(node.args[2])
      };
    case "FunctionFactorial":
      return {
        type: "Factorial",
        arg: {
          type: "FunctionCall",
          callee: nodeToIdentifier(node.args[0]),
          args: [childNodeToTree(node.args[1])]
        }
      };
    case "Integral":
      return {
        type: "Integral",
        differential: nodeToIdentifier(node.args[0]),
        start: childNodeToTree(node.args[1]),
        end: childNodeToTree(node.args[2]),
        integrand: childNodeToTree(node.args[3])
      };
    case "Derivative":
      return {
        type: "Derivative",
        arg: childNodeToTree(node.args[0]),
        variable: parseIdentifier(node._symbol)
      };
    case "Prime": {
      const primeArg = childNodeToTree(node.args[0]);
      if (primeArg.type !== "FunctionCall") {
        throw Error("Expected function call as argument of prime");
      }
      return {
        type: "Prime",
        arg: primeArg,
        order: node.order
      };
    }
    case "List":
      return {
        type: "List",
        args: node.args.map(childNodeToTree)
      };
    case "Range":
      return {
        type: "Range",
        start: node.args[0].args.map(childNodeToTree),
        end: node.args[1].args.map(childNodeToTree)
      };
    case "ListAccess":
      return {
        type: "ListAccess",
        list: childNodeToTree(node.args[0]),
        index: childNodeToTree(node.args[1])
      };
    case "DotAccess": {
      const prop = childNodeToTree(node.args[1]);
      if (prop.type !== "Identifier" && prop.type !== "FunctionCall") {
        throw Error(
          "Dot access property is not an identifier or function call"
        );
      }
      return {
        type: "DotAccess",
        object: childNodeToTree(node.args[0]),
        property: prop
      };
    }
    case "NamedCoordinateAccess": {
      return {
        type: "OrderedPairAccess",
        point: childNodeToTree(node.args[0]),
        index: node.symbol
      };
    }
    case "BareSeq":
    case "ParenSeq":
      return {
        type: "Seq",
        parenWrapped: node.type === "ParenSeq",
        args: node.args.map(childNodeToTree)
      };
    case "UpdateRule":
      return {
        type: "UpdateRule",
        variable: parseIdentifier(node._symbol),
        expression: childNodeToTree(node._expression)
      };
    case "ListComprehension":
      return {
        type: "ListComprehension",
        expr: childNodeToTree(node.args[1]),
        assignments: node.args.slice(2).map(assignmentExprToTree),
        parameters: node.parameters.map(
          ({ identifier, open, bounds: [min, max] }) => ({
            identifier: parseIdentifier(identifier._symbol),
            open,
            bounds: [childNodeToTree(min), childNodeToTree(max)]
          })
        ),
        bracketWrapped: node.shouldCoerceToList
      };
    case "Substitution":
      return {
        type: "Substitution",
        body: childNodeToTree(node.args[0]),
        assignments: node.args.slice(1).map(assignmentExprToTree)
      };
    case "Piecewise": {
      const [conditionNode] = node.args;
      const condition = conditionNode.type === "Constant" && conditionNode._constantValue === true ? true : childNodeToTree(conditionNode);
      if (condition !== true && !isPiecewiseBoolean(condition)) {
        throw Error(
          "Expected condition of Piecewise to be a Comparator, DoubleInequality, or true"
        );
      }
      return {
        type: "Piecewise",
        condition,
        consequent: childNodeToTree(node.args[1]),
        alternate: childNodeToTree(node.args[2])
      };
    }
    case "Restriction": {
      const [conditionNode] = node.args;
      const condition = conditionNode.type === "Constant" && conditionNode._constantValue === true ? true : childNodeToTree(conditionNode);
      if (condition !== true && !isRestrictionBoolean(condition)) {
        throw Error(
          "Expected condition of Restriction to be a Comparator, DoubleInequality, Or, or true"
        );
      }
      return { type: "Restriction", condition };
    }
    case "Or": {
      const left = childNodeToTree(node.args[0]);
      const right = childNodeToTree(node.args[1]);
      if (!isRestrictionBoolean(left) || !isRestrictionBoolean(right))
        throw new Error("Expected 'Or' to combine two syntactical booelans.");
      return { type: "Or", left, right };
    }
    case "Product":
    case "Sum":
      return {
        type: "RepeatedOperator",
        name: node.type,
        index: nodeToIdentifier(node._index),
        start: childNodeToTree(node.args[1]),
        end: childNodeToTree(node.args[2]),
        expression: childNodeToTree(node.args[3])
      };
    case "Add":
    case "Subtract":
    case "Multiply":
    case "DotMultiply":
    case "CrossMultiply":
    case "Divide":
    case "Exponent":
      return {
        type: "BinaryOperator",
        name: node.type === "DotMultiply" ? "Multiply" : node.type,
        left: childNodeToTree(node.args[0]),
        right: childNodeToTree(node.args[1])
      };
    case "Positive":
      return {
        type: "Positive",
        arg: childNodeToTree(node.args[0])
      };
    case "Negative":
      return {
        type: "Negative",
        arg: childNodeToTree(node.args[0])
      };
    case "ComparatorChain":
      return {
        type: "ComparatorChain",
        args: node.args.map(childNodeToTree),
        symbols: node.symbols
      };
    case "Comparator['<']":
    case "Comparator['<=']":
    case "Comparator['=']":
    case "Comparator['>=']":
    case "Comparator['>']":
    case "Greater":
    case "Less":
    case "GreaterEqual":
    case "LessEqual":
    case "Equal":
      return {
        type: "Comparator",
        operator: node.operator,
        left: childNodeToTree(node.args[0]),
        right: childNodeToTree(node.args[1])
      };
    case "CallAssignment":
      return {
        type: "Comparator",
        operator: "=",
        left: childNodeToTree(node._lhs),
        right: childNodeToTree(node._rhs)
      };
    case "Paren":
      return childNodeToTree(node.args[0]);
    case "Error":
      throw new Error("Parsing threw an error");
    case "Equation":
    case "Assignment":
    case "FunctionDefinition":
    case "Stats":
    case "AssignmentExpression":
    case "Ans":
    case "DotPlot":
    case "BoxPlot":
    case "Histogram":
    case "IndependentTTest":
    case "TTest":
    case "Regression":
    case "RGBColor":
    case "Image":
    case "Ticker":
    case "SolvedEquation":
    case "Slider":
    case "OptimizedRegression":
    case "IRExpression":
    case "Table":
    case "TableColumn":
      throw new Error(
        `Programming Error: Expected parsenode ${node.type} to not be created`
      );
    default:
      node;
      throw new Error(
        `Programming Error: Unexpected raw node ${node.type}`
      );
  }
}
function assignmentExprToTree(node) {
  if (node.type !== "AssignmentExpression")
    throw Error(
      "Programming Error: expected AssignmentExpression in list comprehension"
    );
  return {
    type: "AssignmentExpression",
    variable: nodeToIdentifier(node.args[0]),
    expression: childNodeToTree(node.args[1])
  };
}
function nodeToIdentifier(node) {
  if (node.type !== "Identifier") {
    throw Error("Expected identifier");
  }
  return parseIdentifier(node._symbol);
}
function parseIdentifier(str) {
  return {
    type: "Identifier",
    symbol: str
  };
}

// ../dsm/prettier-doc/builders.ts
var builders_exports = {};
__export(builders_exports, {
  addAlignmentToDoc: () => addAlignmentToDoc,
  align: () => align,
  breakParent: () => breakParent,
  conditionalGroup: () => conditionalGroup,
  cursor: () => cursor,
  dedent: () => dedent,
  dedentToRoot: () => dedentToRoot,
  fill: () => fill,
  group: () => group,
  hardline: () => hardline,
  hardlineWithoutBreakParent: () => hardlineWithoutBreakParent,
  ifBreak: () => ifBreak,
  indent: () => indent,
  indentIfBreak: () => indentIfBreak,
  join: () => join,
  label: () => label,
  line: () => line,
  lineSuffix: () => lineSuffix,
  lineSuffixBoundary: () => lineSuffixBoundary,
  literalline: () => literalline,
  literallineWithoutBreakParent: () => literallineWithoutBreakParent,
  markAsRoot: () => markAsRoot,
  softline: () => softline,
  trim: () => trim
});
function indent(contents) {
  return { type: "indent" /* Indent */, contents };
}
function align(widthOrString, contents) {
  return { type: "align" /* Align */, contents, n: widthOrString };
}
function group(contents, opts = {}) {
  return {
    type: "group" /* Group */,
    id: opts.id,
    contents,
    break: Boolean(opts.shouldBreak),
    expandedStates: opts.expandedStates
  };
}
function dedentToRoot(contents) {
  return align(Number.NEGATIVE_INFINITY, contents);
}
function markAsRoot(contents) {
  return align({ type: "root" }, contents);
}
function dedent(contents) {
  return align(-1, contents);
}
function conditionalGroup(states, opts) {
  return group(states[0], { ...opts, expandedStates: states });
}
function fill(parts) {
  return { type: "fill" /* Fill */, parts };
}
function ifBreak(breakContents, flatContents = "", opts = {}) {
  return {
    type: "if-break" /* IfBreak */,
    breakContents,
    flatContents,
    groupId: opts.groupId
  };
}
function indentIfBreak(contents, opts) {
  return {
    type: "indent-if-break" /* IndentIfBreak */,
    contents,
    groupId: opts.groupId,
    negate: opts.negate
  };
}
function lineSuffix(contents) {
  return { type: "line-suffix" /* LineSuffix */, contents };
}
var lineSuffixBoundary = { type: "line-suffix-boundary" /* LineSuffixBoundary */ };
var breakParent = { type: "break-parent" /* BreakParent */ };
var trim = { type: "trim" /* Trim */ };
var hardlineWithoutBreakParent = { type: "line" /* Line */, hard: true };
var literallineWithoutBreakParent = {
  type: "line" /* Line */,
  hard: true,
  literal: true
};
var line = { type: "line" /* Line */ };
var softline = { type: "line" /* Line */, soft: true };
var hardline = [hardlineWithoutBreakParent, breakParent];
var literalline = [literallineWithoutBreakParent, breakParent];
var cursor = {
  type: "cursor" /* Cursor */
};
function join(separator, docs) {
  const parts = [];
  for (let i = 0; i < docs.length; i++) {
    if (i !== 0) {
      parts.push(separator);
    }
    parts.push(docs[i]);
  }
  return parts;
}
function addAlignmentToDoc(doc, size, tabWidth) {
  let aligned = doc;
  if (size > 0) {
    for (let i = 0; i < Math.floor(size / tabWidth); ++i) {
      aligned = indent(aligned);
    }
    aligned = align(size % tabWidth, aligned);
    aligned = align(Number.NEGATIVE_INFINITY, aligned);
  }
  return aligned;
}
function label(label2, contents) {
  return label2 ? { type: "label" /* Label */, label: label2, contents } : contents;
}

// ../dsm/node_modules/string-width/node_modules/ansi-regex/index.js
function ansiRegex({ onlyFirst = false } = {}) {
  const ST = "(?:\\u0007|\\u001B\\u005C|\\u009C)";
  const pattern = [
    `[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?${ST})`,
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))"
  ].join("|");
  return new RegExp(pattern, onlyFirst ? void 0 : "g");
}

// ../dsm/node_modules/string-width/node_modules/strip-ansi/index.js
var regex = ansiRegex();
function stripAnsi(string) {
  if (typeof string !== "string") {
    throw new TypeError(`Expected a \`string\`, got \`${typeof string}\``);
  }
  return string.replace(regex, "");
}

// ../dsm/node_modules/string-width/index.js
var import_eastasianwidth = __toESM(require_eastasianwidth(), 1);
var import_emoji_regex = __toESM(require_emoji_regex(), 1);
function stringWidth(string, options = {}) {
  if (typeof string !== "string" || string.length === 0) {
    return 0;
  }
  options = {
    ambiguousIsNarrow: true,
    ...options
  };
  string = stripAnsi(string);
  if (string.length === 0) {
    return 0;
  }
  string = string.replace((0, import_emoji_regex.default)(), "  ");
  const ambiguousCharacterWidth = options.ambiguousIsNarrow ? 1 : 2;
  let width = 0;
  for (const character of string) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 31 || codePoint >= 127 && codePoint <= 159) {
      continue;
    }
    if (codePoint >= 768 && codePoint <= 879) {
      continue;
    }
    const code = import_eastasianwidth.default.eastAsianWidth(character);
    switch (code) {
      case "F":
      case "W":
        width += 2;
        break;
      case "A":
        width += ambiguousCharacterWidth;
        break;
      default:
        width += 1;
    }
  }
  return width;
}

// ../dsm/prettier-doc/utils.ts
function invalidDoc() {
  return new Error("Invalid doc");
}
function isArray(doc) {
  return Array.isArray(doc);
}
function isType(doc, type) {
  return !!doc && doc.type === type;
}
var traverseDocOnExitStackMarker = {};
function traverseDoc(doc, onEnter, onExit, shouldTraverseConditionalGroups) {
  const docsStack = [doc];
  while (docsStack.length > 0) {
    const doc2 = docsStack.pop();
    if (doc2 === traverseDocOnExitStackMarker) {
      onExit?.(docsStack.pop());
      continue;
    }
    if (onExit) {
      docsStack.push(doc2, traverseDocOnExitStackMarker);
    }
    if (onEnter?.(doc2) === false) {
      continue;
    }
    if (typeof doc2 === "string") {
      continue;
    }
    if (isArray(doc2) || isType(doc2, "fill" /* Fill */)) {
      const parts = isArray(doc2) ? doc2 : doc2.parts;
      for (let ic = parts.length, i = ic - 1; i >= 0; --i) {
        docsStack.push(parts[i]);
      }
      continue;
    }
    switch (doc2.type) {
      case "if-break" /* IfBreak */:
        docsStack.push(doc2.flatContents, doc2.breakContents);
        break;
      case "group" /* Group */:
        if (shouldTraverseConditionalGroups && doc2.expandedStates) {
          for (let ic = doc2.expandedStates.length, i = ic - 1; i >= 0; --i) {
            docsStack.push(doc2.expandedStates[i]);
          }
        } else {
          docsStack.push(doc2.contents);
        }
        break;
      case "align" /* Align */:
      case "indent" /* Indent */:
      case "indent-if-break" /* IndentIfBreak */:
      case "label" /* Label */:
      case "line-suffix" /* LineSuffix */:
        docsStack.push(doc2.contents);
        break;
      case "cursor" /* Cursor */:
      case "trim" /* Trim */:
      case "line-suffix-boundary" /* LineSuffixBoundary */:
      case "line" /* Line */:
      case "break-parent" /* BreakParent */:
        break;
      default:
        doc2;
        throw invalidDoc();
    }
  }
}
function breakParentGroup(groupStack) {
  if (groupStack.length > 0) {
    const parentGroup = groupStack.at(-1);
    if (!parentGroup.expandedStates && !parentGroup.break) {
      parentGroup.break = "propagated";
    }
  }
  return null;
}
function propagateBreaks(doc) {
  const alreadyVisitedSet = /* @__PURE__ */ new Set();
  const groupStack = [];
  function propagateBreaksOnEnterFn(doc2) {
    if (isType(doc2, "break-parent" /* BreakParent */)) {
      breakParentGroup(groupStack);
    }
    if (isType(doc2, "group" /* Group */)) {
      groupStack.push(doc2);
      if (alreadyVisitedSet.has(doc2)) {
        return false;
      }
      alreadyVisitedSet.add(doc2);
    }
  }
  function propagateBreaksOnExitFn(doc2) {
    if (doc2.type === "group" /* Group */) {
      const group3 = groupStack.pop();
      if (group3.break) {
        breakParentGroup(groupStack);
      }
    }
  }
  traverseDoc(
    doc,
    propagateBreaksOnEnterFn,
    propagateBreaksOnExitFn,
    /* shouldTraverseConditionalGroups */
    true
  );
}

// ../dsm/prettier-doc/printer.ts
var notAsciiRegex = /[^\x20-\x7F]/;
function stringWidth2(text3) {
  if (!text3) {
    return 0;
  }
  if (!notAsciiRegex.test(text3)) {
    return text3.length;
  }
  return stringWidth(text3);
}
var MODE_BREAK = /* @__PURE__ */ Symbol("MODE_BREAK");
var MODE_FLAT = /* @__PURE__ */ Symbol("MODE_FLAT");
var CURSOR_PLACEHOLDER = /* @__PURE__ */ Symbol("cursor");
function rootIndent() {
  return { value: "", length: 0, queue: [] };
}
function makeIndent(ind, options) {
  return generateInd(ind, { type: "indent" }, options);
}
function makeAlign(indent3, widthOrDoc, options) {
  if (widthOrDoc === Number.NEGATIVE_INFINITY) {
    return indent3.root ?? rootIndent();
  }
  if (typeof widthOrDoc === "number" && widthOrDoc < 0) {
    return generateInd(indent3, { type: "dedent" }, options);
  }
  if (!widthOrDoc) {
    return indent3;
  }
  if (typeof widthOrDoc === "number") {
    return generateInd(indent3, { type: "numberAlign", n: widthOrDoc }, options);
  }
  if (typeof widthOrDoc === "string") {
    return generateInd(indent3, { type: "stringAlign", n: widthOrDoc }, options);
  }
  widthOrDoc;
  return { ...indent3, root: indent3 };
}
function generateInd(ind, newPart, options) {
  const queue = newPart.type === "dedent" ? ind.queue.slice(0, -1) : [...ind.queue, newPart];
  let value = "";
  let length = 0;
  let lastTabs = 0;
  let lastSpaces = 0;
  for (const part of queue) {
    switch (part.type) {
      case "indent" /* Indent */:
        flush();
        if (options.useTabs) {
          addTabs(1);
        } else {
          addSpaces(options.tabWidth);
        }
        break;
      case "stringAlign":
        flush();
        value += part.n;
        length += part.n.length;
        break;
      case "numberAlign":
        lastTabs += 1;
        lastSpaces += part.n;
        break;
      /* istanbul ignore next */
      default:
        throw new Error(`Unexpected type '${part.type}'`);
    }
  }
  flushSpaces();
  return { ...ind, value, length, queue };
  function addTabs(count) {
    value += "	".repeat(count);
    length += options.tabWidth * count;
  }
  function addSpaces(count) {
    value += " ".repeat(count);
    length += count;
  }
  function flush() {
    if (options.useTabs) {
      flushTabs();
    } else {
      flushSpaces();
    }
  }
  function flushTabs() {
    if (lastTabs > 0) {
      addTabs(lastTabs);
    }
    resetLast();
  }
  function flushSpaces() {
    if (lastSpaces > 0) {
      addSpaces(lastSpaces);
    }
    resetLast();
  }
  function resetLast() {
    lastTabs = 0;
    lastSpaces = 0;
  }
}
function trim2(out) {
  let trimCount = 0;
  let cursorCount = 0;
  let outIndex = out.length;
  outer: while (outIndex--) {
    const last = out[outIndex];
    if (last === CURSOR_PLACEHOLDER) {
      cursorCount++;
      continue;
    }
    for (let charIndex = last.length - 1; charIndex >= 0; charIndex--) {
      const char = last[charIndex];
      if (char === " " || char === "	") {
        trimCount++;
      } else {
        out[outIndex] = last.slice(0, charIndex + 1);
        break outer;
      }
    }
  }
  if (trimCount > 0 || cursorCount > 0) {
    out.length = outIndex + 1;
    while (cursorCount-- > 0) {
      out.push(CURSOR_PLACEHOLDER);
    }
  }
  return trimCount;
}
function fits(next, restCommands, width, hasLineSuffix, groupModeMap, mustBeFlat) {
  if (width === Number.POSITIVE_INFINITY) {
    return true;
  }
  let restIdx = restCommands.length;
  const cmds = [next];
  const out = [];
  while (width >= 0) {
    if (cmds.length === 0) {
      if (restIdx === 0) {
        return true;
      }
      cmds.push(restCommands[--restIdx]);
      continue;
    }
    const { mode, doc } = cmds.pop();
    if (typeof doc === "string") {
      out.push(doc);
      width -= stringWidth2(doc);
    } else if (isArray(doc) || doc.type === "fill" /* Fill */) {
      const parts = isArray(doc) ? doc : doc.parts;
      for (let i = parts.length - 1; i >= 0; i--) {
        cmds.push({ mode, doc: parts[i] });
      }
    } else {
      switch (doc.type) {
        case "indent" /* Indent */:
        case "align" /* Align */:
        case "indent-if-break" /* IndentIfBreak */:
        case "label" /* Label */:
          cmds.push({ mode, doc: doc.contents });
          break;
        case "trim" /* Trim */:
          width += trim2(out);
          break;
        case "group" /* Group */: {
          if (mustBeFlat && doc.break) {
            return false;
          }
          const groupMode = doc.break ? MODE_BREAK : mode;
          const contents = doc.expandedStates && groupMode === MODE_BREAK ? doc.expandedStates.at(-1) : doc.contents;
          cmds.push({ mode: groupMode, doc: contents });
          break;
        }
        case "if-break" /* IfBreak */: {
          const groupMode = doc.groupId ? groupModeMap[doc.groupId] || MODE_FLAT : mode;
          const contents = groupMode === MODE_BREAK ? doc.breakContents : doc.flatContents;
          if (contents) {
            cmds.push({ mode, doc: contents });
          }
          break;
        }
        case "line" /* Line */:
          if (mode === MODE_BREAK || doc.hard) {
            return true;
          }
          if (!doc.soft) {
            out.push(" ");
            width--;
          }
          break;
        case "line-suffix" /* LineSuffix */:
          hasLineSuffix = true;
          break;
        case "line-suffix-boundary" /* LineSuffixBoundary */:
          if (hasLineSuffix) {
            return false;
          }
          break;
      }
    }
  }
  return false;
}
function printDocToString(doc, options) {
  const groupModeMap = {};
  const width = options.printWidth;
  const newLine = "\n";
  let pos2 = 0;
  const cmds = [{ ind: rootIndent(), mode: MODE_BREAK, doc }];
  const out = [];
  let shouldRemeasure = false;
  const lineSuffix2 = [];
  let printedCursorCount = 0;
  propagateBreaks(doc);
  while (cmds.length > 0) {
    const { ind, mode, doc: doc2 } = cmds.pop();
    if (typeof doc2 === "string") {
      const formatted = newLine !== "\n" ? doc2.replace(/\n/g, newLine) : doc2;
      out.push(formatted);
      if (cmds.length > 0) {
        pos2 += stringWidth2(formatted);
      }
    } else if (isArray(doc2)) {
      for (let i = doc2.length - 1; i >= 0; i--) {
        cmds.push({ ind, mode, doc: doc2[i] });
      }
    } else {
      switch (doc2.type) {
        case "cursor" /* Cursor */:
          if (printedCursorCount >= 2) {
            throw new Error("There are too many 'cursor' in doc.");
          }
          out.push(CURSOR_PLACEHOLDER);
          printedCursorCount++;
          break;
        case "indent" /* Indent */:
          cmds.push({ ind: makeIndent(ind, options), mode, doc: doc2.contents });
          break;
        case "align" /* Align */:
          cmds.push({
            ind: makeAlign(ind, doc2.n, options),
            mode,
            doc: doc2.contents
          });
          break;
        case "trim" /* Trim */:
          pos2 -= trim2(out);
          break;
        case "group" /* Group */:
          switch (mode) {
            case MODE_FLAT:
              if (!shouldRemeasure) {
                cmds.push({
                  ind,
                  mode: doc2.break ? MODE_BREAK : MODE_FLAT,
                  doc: doc2.contents
                });
                break;
              }
            // fallthrough
            case MODE_BREAK: {
              shouldRemeasure = false;
              const next = { ind, mode: MODE_FLAT, doc: doc2.contents };
              const rem = width - pos2;
              const hasLineSuffix = lineSuffix2.length > 0;
              if (!doc2.break && fits(next, cmds, rem, hasLineSuffix, groupModeMap)) {
                cmds.push(next);
              } else {
                if (doc2.expandedStates) {
                  const mostExpanded = doc2.expandedStates.at(-1);
                  if (doc2.break) {
                    cmds.push({ ind, mode: MODE_BREAK, doc: mostExpanded });
                    break;
                  } else {
                    for (let i = 1; i < doc2.expandedStates.length + 1; i++) {
                      if (i >= doc2.expandedStates.length) {
                        cmds.push({ ind, mode: MODE_BREAK, doc: mostExpanded });
                        break;
                      } else {
                        const state = doc2.expandedStates[i];
                        const cmd = {
                          ind,
                          mode: MODE_FLAT,
                          doc: state
                        };
                        if (fits(cmd, cmds, rem, hasLineSuffix, groupModeMap)) {
                          cmds.push(cmd);
                          break;
                        }
                      }
                    }
                  }
                } else {
                  cmds.push({ ind, mode: MODE_BREAK, doc: doc2.contents });
                }
              }
              break;
            }
          }
          if (doc2.id) {
            groupModeMap[doc2.id] = cmds.at(-1).mode;
          }
          break;
        // Fills each line with as much code as possible before moving to a new
        // line with the same indentation.
        //
        // Expects doc.parts to be an array of alternating content and
        // whitespace. The whitespace contains the linebreaks.
        //
        // For example:
        //   ["I", line, "love", line, "monkeys"]
        // or
        //   [{ type: group, ... }, softline, { type: group, ... }]
        //
        // It uses this parts structure to handle three main layout cases:
        // * The first two content items fit on the same line without
        //   breaking
        //   -> output the first content item and the whitespace "flat".
        // * Only the first content item fits on the line without breaking
        //   -> output the first content item "flat" and the whitespace with
        //   "break".
        // * Neither content item fits on the line without breaking
        //   -> output the first content item and the whitespace with "break".
        case "fill" /* Fill */: {
          const rem = width - pos2;
          const { parts } = doc2;
          if (parts.length === 0) {
            break;
          }
          const [content, whitespace] = parts;
          const contentFlatCmd = {
            ind,
            mode: MODE_FLAT,
            doc: content
          };
          const contentBreakCmd = {
            ind,
            mode: MODE_BREAK,
            doc: content
          };
          const contentFits = fits(
            contentFlatCmd,
            [],
            rem,
            lineSuffix2.length > 0,
            groupModeMap,
            true
          );
          if (parts.length === 1) {
            if (contentFits) {
              cmds.push(contentFlatCmd);
            } else {
              cmds.push(contentBreakCmd);
            }
            break;
          }
          const whitespaceFlatCmd = {
            ind,
            mode: MODE_FLAT,
            doc: whitespace
          };
          const whitespaceBreakCmd = {
            ind,
            mode: MODE_BREAK,
            doc: whitespace
          };
          if (parts.length === 2) {
            if (contentFits) {
              cmds.push(whitespaceFlatCmd, contentFlatCmd);
            } else {
              cmds.push(whitespaceBreakCmd, contentBreakCmd);
            }
            break;
          }
          parts.splice(0, 2);
          const remainingCmd = { ind, mode, doc: fill(parts) };
          const [secondContent] = parts;
          const firstAndSecondContentFlatCmd = {
            ind,
            mode: MODE_FLAT,
            doc: [content, whitespace, secondContent]
          };
          const firstAndSecondContentFits = fits(
            firstAndSecondContentFlatCmd,
            [],
            rem,
            lineSuffix2.length > 0,
            groupModeMap,
            true
          );
          if (firstAndSecondContentFits) {
            cmds.push(remainingCmd, whitespaceFlatCmd, contentFlatCmd);
          } else if (contentFits) {
            cmds.push(remainingCmd, whitespaceBreakCmd, contentFlatCmd);
          } else {
            cmds.push(remainingCmd, whitespaceBreakCmd, contentBreakCmd);
          }
          break;
        }
        case "if-break" /* IfBreak */:
        case "indent-if-break" /* IndentIfBreak */: {
          const groupMode = doc2.groupId ? groupModeMap[doc2.groupId] : mode;
          if (groupMode === MODE_BREAK) {
            const breakContents = doc2.type === "if-break" /* IfBreak */ ? doc2.breakContents : doc2.negate ? doc2.contents : indent(doc2.contents);
            if (breakContents) {
              cmds.push({ ind, mode, doc: breakContents });
            }
          }
          if (groupMode === MODE_FLAT) {
            const flatContents = doc2.type === "if-break" /* IfBreak */ ? doc2.flatContents : doc2.negate ? indent(doc2.contents) : doc2.contents;
            if (flatContents) {
              cmds.push({ ind, mode, doc: flatContents });
            }
          }
          break;
        }
        case "line-suffix" /* LineSuffix */:
          lineSuffix2.push({ ind, mode, doc: doc2.contents });
          break;
        case "line-suffix-boundary" /* LineSuffixBoundary */:
          if (lineSuffix2.length > 0) {
            cmds.push({ ind, mode, doc: hardline });
          }
          break;
        case "line" /* Line */:
          switch (mode) {
            case MODE_FLAT:
              if (!doc2.hard) {
                if (!doc2.soft) {
                  out.push(" ");
                  pos2 += 1;
                }
                break;
              } else {
                shouldRemeasure = true;
              }
            // fallthrough
            case MODE_BREAK:
              if (lineSuffix2.length > 0) {
                cmds.push({ ind, mode, doc: doc2 }, ...lineSuffix2.reverse());
                lineSuffix2.length = 0;
                break;
              }
              if (doc2.literal) {
                if (ind.root) {
                  out.push(newLine, ind.root.value);
                  pos2 = ind.root.length;
                } else {
                  out.push(newLine);
                  pos2 = 0;
                }
              } else {
                pos2 -= trim2(out);
                out.push(newLine + ind.value);
                pos2 = ind.length;
              }
              break;
          }
          break;
        case "label" /* Label */:
          cmds.push({ ind, mode, doc: doc2.contents });
          break;
        default:
      }
    }
    if (cmds.length === 0 && lineSuffix2.length > 0) {
      cmds.push(...lineSuffix2.reverse());
      lineSuffix2.length = 0;
    }
  }
  const cursorPlaceholderIndex = out.indexOf(CURSOR_PLACEHOLDER);
  if (cursorPlaceholderIndex !== -1) {
    const otherCursorPlaceholderIndex = out.indexOf(
      CURSOR_PLACEHOLDER,
      cursorPlaceholderIndex + 1
    );
    const beforeCursor = out.slice(0, cursorPlaceholderIndex).join("");
    const aroundCursor = out.slice(cursorPlaceholderIndex + 1, otherCursorPlaceholderIndex).join("");
    const afterCursor = out.slice(otherCursorPlaceholderIndex + 1).join("");
    return {
      formatted: beforeCursor + aroundCursor + afterCursor,
      cursorNodeStart: beforeCursor.length,
      cursorNodeText: aroundCursor
    };
  }
  return { formatted: out.join("") };
}

// ../dsm/text-mode-core/up/needsParens.ts
function needsParens(path) {
  const { parent, node, name } = path;
  if (node.type === "SequenceExpression" && node.parenWrapped) return true;
  if (parent === null) return false;
  if (node.type === "SequenceExpression")
    return parent.type === "MappingEntry";
  if (isNonExpression(node) || isNonExpression(parent) && parent.type !== "PiecewiseBranch")
    return false;
  const nodeIsLikeSub = node.type === "Substitution";
  switch (parent.type) {
    // TODO
    case "RepeatedExpression":
      return name === "expr";
    case "CallExpression":
      return name === "callee" && node.type !== "Identifier" && node.type !== "MemberExpression" || nodeIsLikeSub;
    case "ListExpression":
    case "RangeExpression":
      return nodeIsLikeSub;
    case "ListComprehension":
    case "Substitution":
      return false;
    case "MemberExpression":
      return name !== "object" || node.type !== "Identifier";
  }
  switch (node.type) {
    case "Identifier":
    case "String":
      return false;
    case "RepeatedExpression":
      return true;
    case "ListComprehension":
      if (node.bracketWrapped) return false;
    // fallthrough to Substitution.
    case "Substitution":
      switch (parent.type) {
        case "UpdateRule":
          return false;
        default:
          return true;
      }
    case "Or":
    // "Or" is always a direct child of Or or Piecewise
    case "RangeExpression":
    case "ListExpression":
    case "PiecewiseExpression":
    case "Restriction":
      return false;
    case "Number":
      if (node.value >= 0) return false;
    // fall through since "-1" parses like a prefix
    case "PrefixExpression":
      switch (parent.type) {
        case "PrefixExpression":
        case "ListAccessExpression":
        case "PostfixExpression":
          return true;
        case "BinaryExpression":
          return name === "left" && parent.op === "^";
        default:
          return false;
      }
    case "UpdateRule":
      switch (parent.type) {
        case "SequenceExpression":
          return false;
        case "BinaryExpression":
          return isArithmetic(parent);
        case "PiecewiseExpression":
        case "PiecewiseBranch":
          return false;
        /* istanbul ignore next */
        default:
          return true;
      }
    case "MemberExpression":
    case "ListAccessExpression":
      return false;
    case "BinaryExpression":
    case "ComparatorChain":
      switch (parent.type) {
        case "DerivativeExpression":
        case "PrefixExpression":
        case "PostfixExpression":
          return true;
        case "ListAccessExpression":
          return name === "expr";
        case "BinaryExpression": {
          if (node.type === "ComparatorChain") return true;
          const precedence = getPrecedence(node.op);
          const parentPrecedence = getPrecedence(parent.op);
          if (parentPrecedence > precedence) return true;
          if (parentPrecedence === precedence) {
            if (name === "right" || parent.op === "^" || getPrecedence(parent.op) === getPrecedence("*") && // For clarity, always parenthesize multiplication in division or cross product or vice versa etc.
            getPrecedence(node.op) === getPrecedence("*") && parent.op !== node.op || comparisonOps.includes(parent.op) && comparisonOps.includes(node.op))
              return true;
          }
          return false;
        }
        default:
          return false;
      }
    case "PostfixExpression":
      return parent.type === "PrefixExpression";
    case "Norm":
    case "CallExpression":
    case "PrimeExpression":
      return false;
    case "DerivativeExpression":
      return true;
    /* istanbul ignore next */
    default:
      node;
      throw new Error(
        `Programming Error: Unexpected Text node ${node.type}`
      );
  }
}
function isStatement2(node) {
  return node.type === "ExprStatement" || node.type === "Table" || node.type === "Image" || node.type === "Text" || node.type === "Folder" || node.type === "Settings" || node.type === "Ticker";
}
function isNonExpression(node) {
  return isStatement2(node) || node.type === "Program" || node.type === "RegressionParameters" || node.type === "RegressionEntry" || node.type === "StyleMapping" || node.type === "MappingEntry" || node.type === "AssignmentExpression" || node.type === "PiecewiseBranch";
}
function isArithmetic(expr) {
  const { op } = expr;
  return op === "^" || op === "*" || op === "/" || op === "+" || op === "-";
}
var comparisonOps = ["<", ">", "<=", ">=", "="];
var PRECEDENCE = new Map(
  [
    ["<", ">", "<=", ">=", "="],
    ["~"],
    ["+", "-"],
    ["*", "cross", "/"],
    ["^"]
  ].flatMap((operators, index) => operators.map((op) => [op, index]))
);
function getPrecedence(operator) {
  return PRECEDENCE.get(operator);
}

// ../dsm/text-mode-core/up/astToText.ts
var { group: group2, indent: indent2, join: join2, ifBreak: ifBreak2 } = builders_exports;
var EmitContext = class {
  constructor(optsConfig = {}) {
    const noOptionalSpaces = optsConfig.noOptionalSpaces ?? false;
    const noNewlines = optsConfig.noNewlines ?? false;
    this.opts = {
      noOptionalSpaces,
      noNewlines
    };
    this.statementSep = noNewlines ? ";" : [hardline, hardline];
    this.line = noOptionalSpaces ? noNewlines ? [] : softline : noNewlines ? " " : line;
    this.hardline = noNewlines ? [] : hardline;
    this.softline = noNewlines ? [] : softline;
    this.optionalSpace = noOptionalSpaces ? [] : " ";
    this.comma = [",", this.optionalSpace];
  }
  docToString(doc) {
    return printDocToString(doc, {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false
    }).formatted;
  }
};
function astToText(item, emitOpts) {
  const ctx = new EmitContext(emitOpts);
  const path = new NodePath2(item, null);
  return ctx.docToString(astToTextDoc(ctx, path));
}
function astToTextDoc(ctx, path) {
  switch (path.node.type) {
    case "Program":
      return join2(
        ctx.statementSep,
        path.node.children.map(
          (child, i) => astItemToText(ctx, path.withChild(child, "child." + i.toString()))
        )
      );
    case "ExprStatement":
    case "Table":
    case "Image":
    case "Text":
    case "Folder":
    case "Settings":
    case "Ticker":
      return astItemToText(ctx, path);
    case "RegressionParameters":
      return regressionParamsToText(
        ctx,
        path
      );
    case "RegressionEntry":
      return regressionEntryToText(
        ctx,
        path
      );
    case "StyleMapping":
      return styleMapToText(ctx, path);
    case "MappingEntry":
      return styleEntryToText(ctx, path);
    case "PiecewiseBranch":
      return piecewiseBranchToText(
        ctx,
        path
      );
    case "Identifier":
    case "Number":
    case "String":
    case "AssignmentExpression":
    case "RepeatedExpression":
    case "RangeExpression":
    case "ListExpression":
    case "ListComprehension":
    case "Substitution":
    case "PiecewiseExpression":
    case "Restriction":
    case "Or":
    case "PrefixExpression":
    case "Norm":
    case "SequenceExpression":
    case "UpdateRule":
    case "MemberExpression":
    case "ListAccessExpression":
    case "BinaryExpression":
    case "ComparatorChain":
    case "PostfixExpression":
    case "CallExpression":
    case "PrimeExpression":
    case "DerivativeExpression":
      return exprToText(ctx, path);
    default:
      path.node;
      throw new Error(`Invalid node: ${path.node?.type}`);
  }
}
function astItemToText(ctx, path) {
  const item = path.node;
  switch (item.type) {
    case "ExprStatement":
      return [
        item.residualVariable ? [
          item.residualVariable.name,
          ctx.optionalSpace,
          "=",
          ctx.optionalSpace
        ] : "",
        exprToText(ctx, path.withChild(item.expr, "expr")),
        item.parameters ? trailingRegressionParams(
          ctx,
          path.withChild(item.parameters, "parameters")
        ) : "",
        trailingStyleMap(ctx, path, item.style)
      ];
    case "Image":
      return [
        "image",
        ctx.optionalSpace,
        stringToText(item.name),
        trailingStyleMap(ctx, path, item.style)
      ];
    case "Table":
      return [
        "table",
        ctx.optionalSpace,
        "{",
        indent2([
          ctx.hardline,
          join2(
            ctx.statementSep,
            item.columns.map(
              (col, i) => columnToText(ctx, path.withChild(col, "column." + i.toString()))
            )
          )
        ]),
        ctx.hardline,
        "}",
        trailingStyleMap(ctx, path, item.style)
      ];
    case "Text":
      return [stringToText(item.text), trailingStyleMap(ctx, path, item.style)];
    case "Folder":
      return [
        "folder",
        ctx.optionalSpace,
        stringToText(item.title),
        ctx.optionalSpace,
        "{",
        indent2([
          ctx.hardline,
          join2(
            ctx.statementSep,
            item.children.map(
              (child, i) => astItemToText(ctx, path.withChild(child, "child." + i.toString()))
            )
          )
        ]),
        ctx.hardline,
        "}",
        trailingStyleMap(ctx, path, item.style)
      ];
    case "Settings":
      return ["settings", trailingStyleMap(ctx, path, item.style)];
    case "Ticker":
      return [
        maybeRequiredSpace(
          ctx,
          "ticker",
          " ",
          exprToText(ctx, path.withChild(item.handler, "handler"))
        ),
        trailingStyleMap(ctx, path, item.style)
      ];
  }
}
function columnToText(ctx, path) {
  return [
    exprToText(ctx, path.withChild(path.node.expr, "expr")),
    trailingStyleMap(ctx, path, path.node.style)
  ];
}
function trailingStyleMap(ctx, parentPath, node) {
  if (node === null) return [];
  return [
    ctx.optionalSpace,
    styleMapToText(ctx, parentPath.withChild(node, "style"))
  ];
}
function styleMapToText(ctx, path) {
  const lines = path.node.entries.map((entry, i, list) => [
    styleEntryToText(ctx, path.withChild(entry, "entry." + i.toString())),
    i === list.length - 1 ? ctx.opts.noNewlines ? "" : ifBreak2(",", "") : ","
  ]);
  return group2([
    "@{",
    indent2([ctx.line, join2(ctx.line, lines)]),
    ctx.line,
    "}"
  ]);
}
function styleEntryToText(ctx, path) {
  const entry = path.node;
  return [
    entry.property.value,
    ":",
    ctx.optionalSpace,
    entry.expr.type === "StyleMapping" ? styleMapToText(ctx, path.withChild(entry.expr, "expr")) : exprToText(ctx, path.withChild(entry.expr, "expr"))
  ];
}
function trailingRegressionParams(ctx, path) {
  return [ctx.optionalSpace, regressionParamsToText(ctx, path)];
}
function regressionParamsToText(ctx, path) {
  const lines = join2(
    ctx.line,
    path.node.entries.map(
      (entry, i) => regressionEntryToText(ctx, path.withChild(entry, "entry." + i.toString()))
    )
  );
  return ["#{", indent2([ctx.line, lines]), ctx.line, "}"];
}
function regressionEntryToText(ctx, path) {
  return [
    exprToText(ctx, path.withChild(path.node.variable, "variable")),
    ctx.optionalSpace,
    "=",
    ctx.optionalSpace,
    exprToText(ctx, path.withChild(path.node.value, "value"))
  ];
}
function stringToText(str) {
  return JSON.stringify(str);
}
function primeOrCallToText(ctx, path, primeOrder) {
  return group2([
    exprToText(ctx, path.withChild(path.node.callee, "callee")),
    "'".repeat(primeOrder),
    parenthesize(
      ctx,
      join2(
        [",", ctx.line],
        path.node.arguments.map(
          (e, i) => exprToText(ctx, path.withChild(e, "argument." + i.toString()))
        )
      )
    )
  ]);
}
function exprToText(ctx, path) {
  if (path.node.type === "SequenceExpression" && isNumericOrNumericPoint(path.node)) {
    return [
      "(",
      exprToText(ctx, path.withChild(path.node.left, "left")),
      ctx.comma,
      exprToText(ctx, path.withChild(path.node.right, "right")),
      ")"
    ];
  }
  const inner = exprToTextNoParen(ctx, path);
  if (needsParens(path)) return parenthesize(ctx, inner);
  return inner;
}
function maybeRequiredSpace(ctx, left, space, right) {
  if (!ctx.opts.noOptionalSpaces || endsWithWord(left) && startsWithWord(right)) {
    return [left, space, right];
  } else {
    return [left, right];
  }
}
function exprToTextNoParen(ctx, path) {
  const e = path.node;
  switch (e.type) {
    case "Number":
      return numToText(e.value);
    case "Identifier":
      return e.name;
    case "CallExpression":
      return primeOrCallToText(
        ctx,
        path,
        0
      );
    case "PrimeExpression":
      return primeOrCallToText(ctx, path.withChild(e.expr, "expr"), e.order);
    case "DerivativeExpression":
      return group2([
        "(d/d",
        " ",
        exprToText(ctx, path.withChild(e.variable, "variable")),
        ")",
        ctx.line,
        exprToText(ctx, path.withChild(e.expr, "expr"))
      ]);
    case "RepeatedExpression":
      return group2([
        e.name,
        " ",
        e.index.name,
        "=",
        parenthesize(ctx, [
          exprToText(ctx, path.withChild(e.start, "start")),
          ctx.optionalSpace,
          "...",
          ctx.optionalSpace,
          exprToText(ctx, path.withChild(e.end, "end"))
        ]),
        ctx.line,
        exprToText(ctx, path.withChild(e.expr, "expr"))
      ]);
    case "ListExpression":
      return listToText(ctx, path);
    case "RangeExpression":
      return bracketize(ctx, [
        group2(
          join2(
            ctx.comma,
            e.startValues.map(
              (v, i) => exprToText(ctx, path.withChild(v, "startValues." + i.toString()))
            )
          )
        ),
        ctx.line,
        "...",
        ctx.line,
        group2(
          join2(
            ctx.comma,
            e.endValues.map(
              (v, i) => exprToText(ctx, path.withChild(v, "endValues." + i.toString()))
            )
          )
        )
      ]);
    case "ListAccessExpression": {
      const listAccessIndex = exprToText(ctx, path.withChild(e.index, "index"));
      return [
        exprToText(ctx, path.withChild(e.expr, "expr")),
        group2(
          e.index.type === "RangeExpression" || e.index.type === "ListExpression" ? listAccessIndex : bracketize(ctx, listAccessIndex)
        )
      ];
    }
    case "MemberExpression":
      return group2([
        exprToText(ctx, path.withChild(e.object, "object")),
        ".",
        e.property.name
      ]);
    case "SequenceExpression":
      return group2([
        exprToText(ctx, path.withChild(e.left, "left")),
        ",",
        ctx.line,
        exprToText(ctx, path.withChild(e.right, "right"))
      ]);
    case "UpdateRule":
      return group2([
        e.variable.name,
        ctx.optionalSpace,
        "->",
        ctx.optionalSpace,
        exprToText(ctx, path.withChild(e.expr, "expr"))
      ]);
    case "ListComprehension": {
      const assignments = e.assignments.map(
        (assignment2, i) => assignmentExpressionToText(
          ctx,
          path.withChild(assignment2, `assignments.${i}`)
        )
      );
      const intervalParameters = e.parameters.map(
        ({ identifier, open, bounds: [min, max] }, i) => group2([
          exprToText(ctx, path.withChild(min, `param.${i}.min`)),
          ctx.optionalSpace,
          open[0] ? "<" : "<=",
          ctx.optionalSpace,
          exprToText(ctx, path.withChild(identifier, `param.${i}.ident`)),
          ctx.optionalSpace,
          open[1] ? "<" : "<=",
          ctx.optionalSpace,
          exprToText(ctx, path.withChild(max, `param.${i}.max`))
        ])
      );
      const unwrapped = [
        maybeRequiredSpace(
          ctx,
          exprToText(ctx, path.withChild(e.expr, "expr")),
          " ",
          "for"
        ),
        " ",
        join2(ctx.comma, [...intervalParameters, ...assignments])
      ];
      return e.bracketWrapped ? bracketize(ctx, unwrapped) : unwrapped;
    }
    case "Substitution":
      return group2([
        maybeRequiredSpace(
          ctx,
          exprToText(ctx, path.withChild(e.body, "body")),
          ctx.opts.noNewlines ? " " : line,
          "with"
        ),
        " ",
        join2(
          ctx.comma,
          e.assignments.map(
            (assignment2, i) => assignmentExpressionToText(
              ctx,
              path.withChild(assignment2, `assignments.${i}`)
            )
          )
        )
      ]);
    case "PiecewiseExpression":
      return group2([
        "{",
        indent2([
          ctx.softline,
          join2(
            [",", ctx.line],
            e.branches.map(
              (branch, i) => piecewiseBranchToText(
                ctx,
                path.withChild(branch, `branches.${i}`)
              )
            )
          )
        ]),
        ctx.softline,
        "}"
      ]);
    case "Restriction":
      if (e.condition === true) return "{}";
      return group2([
        "{",
        indent2([
          ctx.softline,
          exprToText(ctx, path.withChild(e.condition, "condition"))
        ]),
        ctx.softline,
        "}"
      ]);
    case "Or":
      return [
        exprToText(ctx, path.withChild(e.left, "left")),
        ",",
        ctx.line,
        exprToText(ctx, path.withChild(e.right, "right"))
      ];
    case "BinaryExpression": {
      const left = exprToText(ctx, path.withChild(e.left, "left"));
      const right = exprToText(ctx, path.withChild(e.right, "right"));
      if (e.op === "cross") {
        return group2([
          left,
          endsWithWord(left) ? " " : ctx.optionalSpace,
          e.op,
          indent2([startsWithWord(right) ? " " : ctx.optionalSpace, right])
        ]);
      }
      return group2([left, ctx.optionalSpace, e.op, indent2([ctx.line, right])]);
    }
    case "ComparatorChain": {
      const g = [];
      for (let i = 0; i < e.args.length; i++) {
        g.push(
          exprToText(ctx, path.withChild(e.args[i], "arg." + i.toString()))
        );
        if (i < e.symbols.length) {
          g.push(ctx.optionalSpace, e.symbols[i], ctx.line);
        }
      }
      return group2(g);
    }
    case "PrefixExpression":
      return [e.op, exprToText(ctx, path.withChild(e.expr, "expr"))];
    case "Norm":
      return ["|", exprToText(ctx, path.withChild(e.expr, "expr")), "|"];
    case "PostfixExpression":
      return [exprToText(ctx, path.withChild(e.expr, "expr")), "!"];
    case "String":
      return stringToText(e.value);
    case "AssignmentExpression":
      return assignmentExpressionToText(
        ctx,
        path
      );
    default:
      e;
      throw new Error(
        `Programming Error: Unexpected AST node ${e.type}`
      );
  }
}
function piecewiseBranchToText(ctx, path) {
  const branch = path.node;
  return group2([
    branch.condition === null ? [] : [
      exprToText(ctx, path.withChild(branch.condition, "condition")),
      ":",
      ctx.line
    ],
    indent2([
      branch.consequent === null ? "1" : exprToText(ctx, path.withChild(branch.consequent, "consequent"))
    ])
  ]);
}
function assignmentExpressionToText(ctx, path) {
  return group2([
    path.node.variable.name,
    ctx.optionalSpace,
    "=",
    ctx.optionalSpace,
    exprToText(ctx, path.withChild(path.node.expr, "expr"))
  ]);
}
function numToText(num) {
  return isFinite(num) ? num.toString().replace("e+", "e") : num > 0 ? "infty" : num < 0 ? "-infty" : "NaN";
}
function parenthesize(ctx, doc) {
  return group2(["(", indent2([ctx.softline, doc]), ctx.softline, ")"]);
}
function bracketize(ctx, doc) {
  return group2(["[", indent2([ctx.softline, doc]), ctx.softline, "]"]);
}
function listToText(ctx, path) {
  const { values } = path.node;
  const printOneLineOnly = values.length > 50 || values.every(isNumericOrNumericPoint);
  const inner = values.map(
    (v, i) => exprToText(ctx, path.withChild(v, "values." + i.toString()))
  );
  return printOneLineOnly ? ["[", join2(ctx.comma, inner), "]"] : bracketize(ctx, join2([",", ctx.line], inner));
}
function isNumericOrNumericPoint(node) {
  return isNumericLikeLiteral(node) || node.type === "SequenceExpression" && node.parenWrapped && isNumericLikeLiteral(node.right) && isNumericLikeLiteral(node.left);
}
function isNumericLikeLiteral(node) {
  return isUnsignedNumericLikeLiteral(node) || node.type === "PrefixExpression" && (node.op === "-" || node.op === "+") && isUnsignedNumericLikeLiteral(node.expr);
}
function isUnsignedNumericLikeLiteral(node) {
  return node.type === "Number" || node.type === "Identifier" && (node.name === "infty" || node.name === "NaN");
}
function startsOrEndsWithWord(dir) {
  function fn(doc) {
    if (!doc) return false;
    if (typeof doc === "string")
      return /[a-zA-Z0-9_]/.test(dir === 0 ? doc[0] : doc[doc.length - 1]);
    if (Array.isArray(doc)) return fn(doc.at(dir));
    switch (doc.type) {
      case "fill" /* Fill */:
        return fn(doc.parts.at(dir));
      case "if-break" /* IfBreak */:
        return fn(doc.flatContents) || fn(doc.breakContents);
      case "group" /* Group */:
        if (doc.expandedStates) {
          return doc.expandedStates.some((d) => fn(d));
        } else {
          return fn(doc.contents);
        }
      case "align" /* Align */:
      case "indent" /* Indent */:
      case "label" /* Label */:
      case "line-suffix" /* LineSuffix */:
        return fn(doc.contents);
      case "indent-if-break" /* IndentIfBreak */:
      case "cursor" /* Cursor */:
      case "trim" /* Trim */:
      case "line-suffix-boundary" /* LineSuffixBoundary */:
      case "line" /* Line */:
      case "break-parent" /* BreakParent */:
        return false;
      default:
        doc;
        throw new Error(`Invalid doc type: ${doc?.type}.`);
    }
  }
  return fn;
}
var startsWithWord = startsOrEndsWithWord(0);
var endsWithWord = startsOrEndsWithWord(-1);

// ../dsm/text-mode-core/up/augToText.ts
function augToText(aug, emitOpts) {
  return astToText(augToTextAST(aug), emitOpts);
}
function graphSettingsToText(settings3, emitOpts) {
  return astToText(graphSettingsToAST(settings3), emitOpts);
}
function itemToText(item, emitOpts) {
  const ast = itemAugToAST(item);
  if (ast === null) return "";
  return astToText(ast, emitOpts);
}

// ../dsm/text-mode-core/up/rawToText.ts
function rawToText(cfg, state) {
  try {
    const aug = rawToAug(cfg, state);
    const augHasError = aug.expressions.list.some(itemHasError);
    const text3 = augToText(aug);
    return [augHasError, text3];
  } catch {
    return [true, `"Error in conversion"`];
  }
}
function itemHasError(item) {
  return (
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    item.error || item.type === "folder" && item.children.some(itemHasError)
  );
}

// ../dsm/text-mode-core/TextModeConfig.ts
function buildConfigFromGlobals(Desmos, calc) {
  const config = calc.controller.getMathquillConfig({});
  return buildConfig({
    operatorNames: config.autoOperatorNames,
    commandNames: config.autoCommands,
    colors: calc?.colors,
    parseDesmosLatex: Desmos.Private.Parser.parse
  });
}
function buildConfig(config) {
  const operatorNames = split(config.operatorNames ?? defaultOperatorNames);
  for (const extra of extraOperatorNames) operatorNames.add(extra);
  return {
    operatorNames,
    commandNames: split(config.commandNames ?? defaultCommandNames),
    colors: config.colors ?? defaultColors,
    parseDesmosLatex: function(s) {
      if (!config.parseDesmosLatex)
        throw new Error(
          "Test Error: trying to parse LaTeX from Desmos, but the config does not define `parseDesmosLatex`."
        );
      return config.parseDesmosLatex(s, {
        allowDt: true,
        allowIndex: true,
        allowIntervalComprehensions: true
      });
    }
  };
}
var extraOperatorNames = [
  // fragile
  "polyGamma",
  "argmin",
  "argmax",
  "uniquePerm",
  "rtxsqpone",
  "rtxsqmone",
  "hypot",
  // required for logbase to be good
  "logbase",
  // true and false have many exceptions
  "true",
  "false",
  // index and dt have many exceptions
  "index",
  "dt"
];
function split(s) {
  return new Set(s.split(" ").map((e) => e.split("|")[0]));
}
var defaultOperatorNames = "exp ln log total length mean median quantile quartile nCr nPr stats stdev stddev stdDev stdevp stddevp stdDevP mad var varp variance cov covp corr spearman lcm mcm gcd mcd gcf mod ceil floor round abs min max sign signum sgn sin cos tan csc sec cot sinh cosh tanh csch sech coth arcsin arccos arctan arccsc arcsec arccot arcsinh arccosh arctanh arccsch arcsech arccoth arsinh arcosh artanh arcsch arsech arcoth polygon distance midpoint sort shuffle join unique erf TTest ttest TScore tscore iTTest ittest IndependentTTest TScore Tscore tscore normaldist tdist poissondist binomialdist uniformdist pdf cdf random inverseCdf inversecdf histogram dotplot boxplot pdf cdf rgb hsv for width height with det inv transpose rref trace";
var defaultCommandNames = "alpha beta sqrt theta phi pi tau nthroot cbrt sum prod integral percent infinity infty cross ans frac";
var defaultColors = {
  RED: "#c74440",
  BLUE: "#2d70b3",
  GREEN: "#348543",
  ORANGE: "#fa7e19",
  PURPLE: "#6042a6",
  BLACK: "#000000"
};
export {
  defaults_exports as StyleDefaults,
  TextAST_exports as TextAST,
  Synthetic_exports as TextASTSynthetic,
  astToText,
  augToText,
  buildConfig,
  buildConfigFromGlobals,
  childExprToAug,
  childLatexToAST,
  graphSettingsToText,
  identifierToString,
  itemAugToAST,
  itemToText,
  parseRootLatex,
  parse as parseText,
  rawNonFolderToAug,
  rawToAugSettings,
  rawToDsmMetadata,
  rawToText,
  textModeExprToLatex,
  textToRaw
};
