#!/usr/bin/env node
import{createRequire}from"module";const require=createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw new Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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

// node_modules/.pnpm/commander@12.1.0/node_modules/commander/lib/error.js
var require_error = __commonJS({
  "node_modules/.pnpm/commander@12.1.0/node_modules/commander/lib/error.js"(exports) {
    var CommanderError2 = class extends Error {
      /**
       * Constructs the CommanderError class
       * @param {number} exitCode suggested exit code which could be used with process.exit
       * @param {string} code an id string representing the error
       * @param {string} message human-readable description of the error
       */
      constructor(exitCode, code, message) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        this.code = code;
        this.exitCode = exitCode;
        this.nestedError = void 0;
      }
    };
    var InvalidArgumentError2 = class extends CommanderError2 {
      /**
       * Constructs the InvalidArgumentError class
       * @param {string} [message] explanation of why argument is invalid
       */
      constructor(message) {
        super(1, "commander.invalidArgument", message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
      }
    };
    exports.CommanderError = CommanderError2;
    exports.InvalidArgumentError = InvalidArgumentError2;
  }
});

// node_modules/.pnpm/commander@12.1.0/node_modules/commander/lib/argument.js
var require_argument = __commonJS({
  "node_modules/.pnpm/commander@12.1.0/node_modules/commander/lib/argument.js"(exports) {
    var { InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var Argument2 = class {
      /**
       * Initialize a new command argument with the given name and description.
       * The default is that the argument is required, and you can explicitly
       * indicate this with <> around the name. Put [] around the name for an optional argument.
       *
       * @param {string} name
       * @param {string} [description]
       */
      constructor(name, description) {
        this.description = description || "";
        this.variadic = false;
        this.parseArg = void 0;
        this.defaultValue = void 0;
        this.defaultValueDescription = void 0;
        this.argChoices = void 0;
        switch (name[0]) {
          case "<":
            this.required = true;
            this._name = name.slice(1, -1);
            break;
          case "[":
            this.required = false;
            this._name = name.slice(1, -1);
            break;
          default:
            this.required = true;
            this._name = name;
            break;
        }
        if (this._name.length > 3 && this._name.slice(-3) === "...") {
          this.variadic = true;
          this._name = this._name.slice(0, -3);
        }
      }
      /**
       * Return argument name.
       *
       * @return {string}
       */
      name() {
        return this._name;
      }
      /**
       * @package
       */
      _concatValue(value, previous) {
        if (previous === this.defaultValue || !Array.isArray(previous)) {
          return [value];
        }
        return previous.concat(value);
      }
      /**
       * Set the default value, and optionally supply the description to be displayed in the help.
       *
       * @param {*} value
       * @param {string} [description]
       * @return {Argument}
       */
      default(value, description) {
        this.defaultValue = value;
        this.defaultValueDescription = description;
        return this;
      }
      /**
       * Set the custom handler for processing CLI command arguments into argument values.
       *
       * @param {Function} [fn]
       * @return {Argument}
       */
      argParser(fn) {
        this.parseArg = fn;
        return this;
      }
      /**
       * Only allow argument value to be one of choices.
       *
       * @param {string[]} values
       * @return {Argument}
       */
      choices(values) {
        this.argChoices = values.slice();
        this.parseArg = (arg, previous) => {
          if (!this.argChoices.includes(arg)) {
            throw new InvalidArgumentError2(
              `Allowed choices are ${this.argChoices.join(", ")}.`
            );
          }
          if (this.variadic) {
            return this._concatValue(arg, previous);
          }
          return arg;
        };
        return this;
      }
      /**
       * Make argument required.
       *
       * @returns {Argument}
       */
      argRequired() {
        this.required = true;
        return this;
      }
      /**
       * Make argument optional.
       *
       * @returns {Argument}
       */
      argOptional() {
        this.required = false;
        return this;
      }
    };
    function humanReadableArgName(arg) {
      const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
      return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
    }
    exports.Argument = Argument2;
    exports.humanReadableArgName = humanReadableArgName;
  }
});

// node_modules/.pnpm/commander@12.1.0/node_modules/commander/lib/help.js
var require_help = __commonJS({
  "node_modules/.pnpm/commander@12.1.0/node_modules/commander/lib/help.js"(exports) {
    var { humanReadableArgName } = require_argument();
    var Help2 = class {
      constructor() {
        this.helpWidth = void 0;
        this.sortSubcommands = false;
        this.sortOptions = false;
        this.showGlobalOptions = false;
      }
      /**
       * Get an array of the visible subcommands. Includes a placeholder for the implicit help command, if there is one.
       *
       * @param {Command} cmd
       * @returns {Command[]}
       */
      visibleCommands(cmd) {
        const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
        const helpCommand = cmd._getHelpCommand();
        if (helpCommand && !helpCommand._hidden) {
          visibleCommands.push(helpCommand);
        }
        if (this.sortSubcommands) {
          visibleCommands.sort((a, b) => {
            return a.name().localeCompare(b.name());
          });
        }
        return visibleCommands;
      }
      /**
       * Compare options for sort.
       *
       * @param {Option} a
       * @param {Option} b
       * @returns {number}
       */
      compareOptions(a, b) {
        const getSortKey = (option) => {
          return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
        };
        return getSortKey(a).localeCompare(getSortKey(b));
      }
      /**
       * Get an array of the visible options. Includes a placeholder for the implicit help option, if there is one.
       *
       * @param {Command} cmd
       * @returns {Option[]}
       */
      visibleOptions(cmd) {
        const visibleOptions = cmd.options.filter((option) => !option.hidden);
        const helpOption = cmd._getHelpOption();
        if (helpOption && !helpOption.hidden) {
          const removeShort = helpOption.short && cmd._findOption(helpOption.short);
          const removeLong = helpOption.long && cmd._findOption(helpOption.long);
          if (!removeShort && !removeLong) {
            visibleOptions.push(helpOption);
          } else if (helpOption.long && !removeLong) {
            visibleOptions.push(
              cmd.createOption(helpOption.long, helpOption.description)
            );
          } else if (helpOption.short && !removeShort) {
            visibleOptions.push(
              cmd.createOption(helpOption.short, helpOption.description)
            );
          }
        }
        if (this.sortOptions) {
          visibleOptions.sort(this.compareOptions);
        }
        return visibleOptions;
      }
      /**
       * Get an array of the visible global options. (Not including help.)
       *
       * @param {Command} cmd
       * @returns {Option[]}
       */
      visibleGlobalOptions(cmd) {
        if (!this.showGlobalOptions)
          return [];
        const globalOptions = [];
        for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
          const visibleOptions = ancestorCmd.options.filter(
            (option) => !option.hidden
          );
          globalOptions.push(...visibleOptions);
        }
        if (this.sortOptions) {
          globalOptions.sort(this.compareOptions);
        }
        return globalOptions;
      }
      /**
       * Get an array of the arguments if any have a description.
       *
       * @param {Command} cmd
       * @returns {Argument[]}
       */
      visibleArguments(cmd) {
        if (cmd._argsDescription) {
          cmd.registeredArguments.forEach((argument) => {
            argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
          });
        }
        if (cmd.registeredArguments.find((argument) => argument.description)) {
          return cmd.registeredArguments;
        }
        return [];
      }
      /**
       * Get the command term to show in the list of subcommands.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      subcommandTerm(cmd) {
        const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
        return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + // simplistic check for non-help option
        (args ? " " + args : "");
      }
      /**
       * Get the option term to show in the list of options.
       *
       * @param {Option} option
       * @returns {string}
       */
      optionTerm(option) {
        return option.flags;
      }
      /**
       * Get the argument term to show in the list of arguments.
       *
       * @param {Argument} argument
       * @returns {string}
       */
      argumentTerm(argument) {
        return argument.name();
      }
      /**
       * Get the longest command term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestSubcommandTermLength(cmd, helper) {
        return helper.visibleCommands(cmd).reduce((max, command) => {
          return Math.max(max, helper.subcommandTerm(command).length);
        }, 0);
      }
      /**
       * Get the longest option term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestOptionTermLength(cmd, helper) {
        return helper.visibleOptions(cmd).reduce((max, option) => {
          return Math.max(max, helper.optionTerm(option).length);
        }, 0);
      }
      /**
       * Get the longest global option term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestGlobalOptionTermLength(cmd, helper) {
        return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
          return Math.max(max, helper.optionTerm(option).length);
        }, 0);
      }
      /**
       * Get the longest argument term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestArgumentTermLength(cmd, helper) {
        return helper.visibleArguments(cmd).reduce((max, argument) => {
          return Math.max(max, helper.argumentTerm(argument).length);
        }, 0);
      }
      /**
       * Get the command usage to be displayed at the top of the built-in help.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      commandUsage(cmd) {
        let cmdName = cmd._name;
        if (cmd._aliases[0]) {
          cmdName = cmdName + "|" + cmd._aliases[0];
        }
        let ancestorCmdNames = "";
        for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
          ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
        }
        return ancestorCmdNames + cmdName + " " + cmd.usage();
      }
      /**
       * Get the description for the command.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      commandDescription(cmd) {
        return cmd.description();
      }
      /**
       * Get the subcommand summary to show in the list of subcommands.
       * (Fallback to description for backwards compatibility.)
       *
       * @param {Command} cmd
       * @returns {string}
       */
      subcommandDescription(cmd) {
        return cmd.summary() || cmd.description();
      }
      /**
       * Get the option description to show in the list of options.
       *
       * @param {Option} option
       * @return {string}
       */
      optionDescription(option) {
        const extraInfo = [];
        if (option.argChoices) {
          extraInfo.push(
            // use stringify to match the display of the default value
            `choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
          );
        }
        if (option.defaultValue !== void 0) {
          const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
          if (showDefault) {
            extraInfo.push(
              `default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`
            );
          }
        }
        if (option.presetArg !== void 0 && option.optional) {
          extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
        }
        if (option.envVar !== void 0) {
          extraInfo.push(`env: ${option.envVar}`);
        }
        if (extraInfo.length > 0) {
          return `${option.description} (${extraInfo.join(", ")})`;
        }
        return option.description;
      }
      /**
       * Get the argument description to show in the list of arguments.
       *
       * @param {Argument} argument
       * @return {string}
       */
      argumentDescription(argument) {
        const extraInfo = [];
        if (argument.argChoices) {
          extraInfo.push(
            // use stringify to match the display of the default value
            `choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
          );
        }
        if (argument.defaultValue !== void 0) {
          extraInfo.push(
            `default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`
          );
        }
        if (extraInfo.length > 0) {
          const extraDescripton = `(${extraInfo.join(", ")})`;
          if (argument.description) {
            return `${argument.description} ${extraDescripton}`;
          }
          return extraDescripton;
        }
        return argument.description;
      }
      /**
       * Generate the built-in help text.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {string}
       */
      formatHelp(cmd, helper) {
        const termWidth = helper.padWidth(cmd, helper);
        const helpWidth = helper.helpWidth || 80;
        const itemIndentWidth = 2;
        const itemSeparatorWidth = 2;
        function formatItem(term, description) {
          if (description) {
            const fullText = `${term.padEnd(termWidth + itemSeparatorWidth)}${description}`;
            return helper.wrap(
              fullText,
              helpWidth - itemIndentWidth,
              termWidth + itemSeparatorWidth
            );
          }
          return term;
        }
        function formatList(textArray) {
          return textArray.join("\n").replace(/^/gm, " ".repeat(itemIndentWidth));
        }
        let output = [`Usage: ${helper.commandUsage(cmd)}`, ""];
        const commandDescription = helper.commandDescription(cmd);
        if (commandDescription.length > 0) {
          output = output.concat([
            helper.wrap(commandDescription, helpWidth, 0),
            ""
          ]);
        }
        const argumentList = helper.visibleArguments(cmd).map((argument) => {
          return formatItem(
            helper.argumentTerm(argument),
            helper.argumentDescription(argument)
          );
        });
        if (argumentList.length > 0) {
          output = output.concat(["Arguments:", formatList(argumentList), ""]);
        }
        const optionList = helper.visibleOptions(cmd).map((option) => {
          return formatItem(
            helper.optionTerm(option),
            helper.optionDescription(option)
          );
        });
        if (optionList.length > 0) {
          output = output.concat(["Options:", formatList(optionList), ""]);
        }
        if (this.showGlobalOptions) {
          const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
            return formatItem(
              helper.optionTerm(option),
              helper.optionDescription(option)
            );
          });
          if (globalOptionList.length > 0) {
            output = output.concat([
              "Global Options:",
              formatList(globalOptionList),
              ""
            ]);
          }
        }
        const commandList = helper.visibleCommands(cmd).map((cmd2) => {
          return formatItem(
            helper.subcommandTerm(cmd2),
            helper.subcommandDescription(cmd2)
          );
        });
        if (commandList.length > 0) {
          output = output.concat(["Commands:", formatList(commandList), ""]);
        }
        return output.join("\n");
      }
      /**
       * Calculate the pad width from the maximum term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      padWidth(cmd, helper) {
        return Math.max(
          helper.longestOptionTermLength(cmd, helper),
          helper.longestGlobalOptionTermLength(cmd, helper),
          helper.longestSubcommandTermLength(cmd, helper),
          helper.longestArgumentTermLength(cmd, helper)
        );
      }
      /**
       * Wrap the given string to width characters per line, with lines after the first indented.
       * Do not wrap if insufficient room for wrapping (minColumnWidth), or string is manually formatted.
       *
       * @param {string} str
       * @param {number} width
       * @param {number} indent
       * @param {number} [minColumnWidth=40]
       * @return {string}
       *
       */
      wrap(str, width, indent, minColumnWidth = 40) {
        const indents = " \\f\\t\\v\xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF";
        const manualIndent = new RegExp(`[\\n][${indents}]+`);
        if (str.match(manualIndent))
          return str;
        const columnWidth = width - indent;
        if (columnWidth < minColumnWidth)
          return str;
        const leadingStr = str.slice(0, indent);
        const columnText = str.slice(indent).replace("\r\n", "\n");
        const indentString = " ".repeat(indent);
        const zeroWidthSpace = "\u200B";
        const breaks = `\\s${zeroWidthSpace}`;
        const regex = new RegExp(
          `
|.{1,${columnWidth - 1}}([${breaks}]|$)|[^${breaks}]+?([${breaks}]|$)`,
          "g"
        );
        const lines = columnText.match(regex) || [];
        return leadingStr + lines.map((line, i) => {
          if (line === "\n")
            return "";
          return (i > 0 ? indentString : "") + line.trimEnd();
        }).join("\n");
      }
    };
    exports.Help = Help2;
  }
});

// node_modules/.pnpm/commander@12.1.0/node_modules/commander/lib/option.js
var require_option = __commonJS({
  "node_modules/.pnpm/commander@12.1.0/node_modules/commander/lib/option.js"(exports) {
    var { InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var Option2 = class {
      /**
       * Initialize a new `Option` with the given `flags` and `description`.
       *
       * @param {string} flags
       * @param {string} [description]
       */
      constructor(flags, description) {
        this.flags = flags;
        this.description = description || "";
        this.required = flags.includes("<");
        this.optional = flags.includes("[");
        this.variadic = /\w\.\.\.[>\]]$/.test(flags);
        this.mandatory = false;
        const optionFlags = splitOptionFlags(flags);
        this.short = optionFlags.shortFlag;
        this.long = optionFlags.longFlag;
        this.negate = false;
        if (this.long) {
          this.negate = this.long.startsWith("--no-");
        }
        this.defaultValue = void 0;
        this.defaultValueDescription = void 0;
        this.presetArg = void 0;
        this.envVar = void 0;
        this.parseArg = void 0;
        this.hidden = false;
        this.argChoices = void 0;
        this.conflictsWith = [];
        this.implied = void 0;
      }
      /**
       * Set the default value, and optionally supply the description to be displayed in the help.
       *
       * @param {*} value
       * @param {string} [description]
       * @return {Option}
       */
      default(value, description) {
        this.defaultValue = value;
        this.defaultValueDescription = description;
        return this;
      }
      /**
       * Preset to use when option used without option-argument, especially optional but also boolean and negated.
       * The custom processing (parseArg) is called.
       *
       * @example
       * new Option('--color').default('GREYSCALE').preset('RGB');
       * new Option('--donate [amount]').preset('20').argParser(parseFloat);
       *
       * @param {*} arg
       * @return {Option}
       */
      preset(arg) {
        this.presetArg = arg;
        return this;
      }
      /**
       * Add option name(s) that conflict with this option.
       * An error will be displayed if conflicting options are found during parsing.
       *
       * @example
       * new Option('--rgb').conflicts('cmyk');
       * new Option('--js').conflicts(['ts', 'jsx']);
       *
       * @param {(string | string[])} names
       * @return {Option}
       */
      conflicts(names) {
        this.conflictsWith = this.conflictsWith.concat(names);
        return this;
      }
      /**
       * Specify implied option values for when this option is set and the implied options are not.
       *
       * The custom processing (parseArg) is not called on the implied values.
       *
       * @example
       * program
       *   .addOption(new Option('--log', 'write logging information to file'))
       *   .addOption(new Option('--trace', 'log extra details').implies({ log: 'trace.txt' }));
       *
       * @param {object} impliedOptionValues
       * @return {Option}
       */
      implies(impliedOptionValues) {
        let newImplied = impliedOptionValues;
        if (typeof impliedOptionValues === "string") {
          newImplied = { [impliedOptionValues]: true };
        }
        this.implied = Object.assign(this.implied || {}, newImplied);
        return this;
      }
      /**
       * Set environment variable to check for option value.
       *
       * An environment variable is only used if when processed the current option value is
       * undefined, or the source of the current value is 'default' or 'config' or 'env'.
       *
       * @param {string} name
       * @return {Option}
       */
      env(name) {
        this.envVar = name;
        return this;
      }
      /**
       * Set the custom handler for processing CLI option arguments into option values.
       *
       * @param {Function} [fn]
       * @return {Option}
       */
      argParser(fn) {
        this.parseArg = fn;
        return this;
      }
      /**
       * Whether the option is mandatory and must have a value after parsing.
       *
       * @param {boolean} [mandatory=true]
       * @return {Option}
       */
      makeOptionMandatory(mandatory = true) {
        this.mandatory = !!mandatory;
        return this;
      }
      /**
       * Hide option in help.
       *
       * @param {boolean} [hide=true]
       * @return {Option}
       */
      hideHelp(hide = true) {
        this.hidden = !!hide;
        return this;
      }
      /**
       * @package
       */
      _concatValue(value, previous) {
        if (previous === this.defaultValue || !Array.isArray(previous)) {
          return [value];
        }
        return previous.concat(value);
      }
      /**
       * Only allow option value to be one of choices.
       *
       * @param {string[]} values
       * @return {Option}
       */
      choices(values) {
        this.argChoices = values.slice();
        this.parseArg = (arg, previous) => {
          if (!this.argChoices.includes(arg)) {
            throw new InvalidArgumentError2(
              `Allowed choices are ${this.argChoices.join(", ")}.`
            );
          }
          if (this.variadic) {
            return this._concatValue(arg, previous);
          }
          return arg;
        };
        return this;
      }
      /**
       * Return option name.
       *
       * @return {string}
       */
      name() {
        if (this.long) {
          return this.long.replace(/^--/, "");
        }
        return this.short.replace(/^-/, "");
      }
      /**
       * Return option name, in a camelcase format that can be used
       * as a object attribute key.
       *
       * @return {string}
       */
      attributeName() {
        return camelcase(this.name().replace(/^no-/, ""));
      }
      /**
       * Check if `arg` matches the short or long flag.
       *
       * @param {string} arg
       * @return {boolean}
       * @package
       */
      is(arg) {
        return this.short === arg || this.long === arg;
      }
      /**
       * Return whether a boolean option.
       *
       * Options are one of boolean, negated, required argument, or optional argument.
       *
       * @return {boolean}
       * @package
       */
      isBoolean() {
        return !this.required && !this.optional && !this.negate;
      }
    };
    var DualOptions = class {
      /**
       * @param {Option[]} options
       */
      constructor(options) {
        this.positiveOptions = /* @__PURE__ */ new Map();
        this.negativeOptions = /* @__PURE__ */ new Map();
        this.dualOptions = /* @__PURE__ */ new Set();
        options.forEach((option) => {
          if (option.negate) {
            this.negativeOptions.set(option.attributeName(), option);
          } else {
            this.positiveOptions.set(option.attributeName(), option);
          }
        });
        this.negativeOptions.forEach((value, key) => {
          if (this.positiveOptions.has(key)) {
            this.dualOptions.add(key);
          }
        });
      }
      /**
       * Did the value come from the option, and not from possible matching dual option?
       *
       * @param {*} value
       * @param {Option} option
       * @returns {boolean}
       */
      valueFromOption(value, option) {
        const optionKey = option.attributeName();
        if (!this.dualOptions.has(optionKey))
          return true;
        const preset = this.negativeOptions.get(optionKey).presetArg;
        const negativeValue = preset !== void 0 ? preset : false;
        return option.negate === (negativeValue === value);
      }
    };
    function camelcase(str) {
      return str.split("-").reduce((str2, word) => {
        return str2 + word[0].toUpperCase() + word.slice(1);
      });
    }
    function splitOptionFlags(flags) {
      let shortFlag;
      let longFlag;
      const flagParts = flags.split(/[ |,]+/);
      if (flagParts.length > 1 && !/^[[<]/.test(flagParts[1]))
        shortFlag = flagParts.shift();
      longFlag = flagParts.shift();
      if (!shortFlag && /^-[^-]$/.test(longFlag)) {
        shortFlag = longFlag;
        longFlag = void 0;
      }
      return { shortFlag, longFlag };
    }
    exports.Option = Option2;
    exports.DualOptions = DualOptions;
  }
});

// node_modules/.pnpm/commander@12.1.0/node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS({
  "node_modules/.pnpm/commander@12.1.0/node_modules/commander/lib/suggestSimilar.js"(exports) {
    var maxDistance = 3;
    function editDistance(a, b) {
      if (Math.abs(a.length - b.length) > maxDistance)
        return Math.max(a.length, b.length);
      const d = [];
      for (let i = 0; i <= a.length; i++) {
        d[i] = [i];
      }
      for (let j = 0; j <= b.length; j++) {
        d[0][j] = j;
      }
      for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
          let cost = 1;
          if (a[i - 1] === b[j - 1]) {
            cost = 0;
          } else {
            cost = 1;
          }
          d[i][j] = Math.min(
            d[i - 1][j] + 1,
            // deletion
            d[i][j - 1] + 1,
            // insertion
            d[i - 1][j - 1] + cost
            // substitution
          );
          if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
            d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
          }
        }
      }
      return d[a.length][b.length];
    }
    function suggestSimilar(word, candidates) {
      if (!candidates || candidates.length === 0)
        return "";
      candidates = Array.from(new Set(candidates));
      const searchingOptions = word.startsWith("--");
      if (searchingOptions) {
        word = word.slice(2);
        candidates = candidates.map((candidate) => candidate.slice(2));
      }
      let similar = [];
      let bestDistance = maxDistance;
      const minSimilarity = 0.4;
      candidates.forEach((candidate) => {
        if (candidate.length <= 1)
          return;
        const distance = editDistance(word, candidate);
        const length = Math.max(word.length, candidate.length);
        const similarity = (length - distance) / length;
        if (similarity > minSimilarity) {
          if (distance < bestDistance) {
            bestDistance = distance;
            similar = [candidate];
          } else if (distance === bestDistance) {
            similar.push(candidate);
          }
        }
      });
      similar.sort((a, b) => a.localeCompare(b));
      if (searchingOptions) {
        similar = similar.map((candidate) => `--${candidate}`);
      }
      if (similar.length > 1) {
        return `
(Did you mean one of ${similar.join(", ")}?)`;
      }
      if (similar.length === 1) {
        return `
(Did you mean ${similar[0]}?)`;
      }
      return "";
    }
    exports.suggestSimilar = suggestSimilar;
  }
});

// node_modules/.pnpm/commander@12.1.0/node_modules/commander/lib/command.js
var require_command = __commonJS({
  "node_modules/.pnpm/commander@12.1.0/node_modules/commander/lib/command.js"(exports) {
    var EventEmitter = __require("node:events").EventEmitter;
    var childProcess2 = __require("node:child_process");
    var path6 = __require("node:path");
    var fs9 = __require("node:fs");
    var process8 = __require("node:process");
    var { Argument: Argument2, humanReadableArgName } = require_argument();
    var { CommanderError: CommanderError2 } = require_error();
    var { Help: Help2 } = require_help();
    var { Option: Option2, DualOptions } = require_option();
    var { suggestSimilar } = require_suggestSimilar();
    var Command2 = class extends EventEmitter {
      /**
       * Initialize a new `Command`.
       *
       * @param {string} [name]
       */
      constructor(name) {
        super();
        this.commands = [];
        this.options = [];
        this.parent = null;
        this._allowUnknownOption = false;
        this._allowExcessArguments = true;
        this.registeredArguments = [];
        this._args = this.registeredArguments;
        this.args = [];
        this.rawArgs = [];
        this.processedArgs = [];
        this._scriptPath = null;
        this._name = name || "";
        this._optionValues = {};
        this._optionValueSources = {};
        this._storeOptionsAsProperties = false;
        this._actionHandler = null;
        this._executableHandler = false;
        this._executableFile = null;
        this._executableDir = null;
        this._defaultCommandName = null;
        this._exitCallback = null;
        this._aliases = [];
        this._combineFlagAndOptionalValue = true;
        this._description = "";
        this._summary = "";
        this._argsDescription = void 0;
        this._enablePositionalOptions = false;
        this._passThroughOptions = false;
        this._lifeCycleHooks = {};
        this._showHelpAfterError = false;
        this._showSuggestionAfterError = true;
        this._outputConfiguration = {
          writeOut: (str) => process8.stdout.write(str),
          writeErr: (str) => process8.stderr.write(str),
          getOutHelpWidth: () => process8.stdout.isTTY ? process8.stdout.columns : void 0,
          getErrHelpWidth: () => process8.stderr.isTTY ? process8.stderr.columns : void 0,
          outputError: (str, write) => write(str)
        };
        this._hidden = false;
        this._helpOption = void 0;
        this._addImplicitHelpCommand = void 0;
        this._helpCommand = void 0;
        this._helpConfiguration = {};
      }
      /**
       * Copy settings that are useful to have in common across root command and subcommands.
       *
       * (Used internally when adding a command using `.command()` so subcommands inherit parent settings.)
       *
       * @param {Command} sourceCommand
       * @return {Command} `this` command for chaining
       */
      copyInheritedSettings(sourceCommand) {
        this._outputConfiguration = sourceCommand._outputConfiguration;
        this._helpOption = sourceCommand._helpOption;
        this._helpCommand = sourceCommand._helpCommand;
        this._helpConfiguration = sourceCommand._helpConfiguration;
        this._exitCallback = sourceCommand._exitCallback;
        this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
        this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
        this._allowExcessArguments = sourceCommand._allowExcessArguments;
        this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
        this._showHelpAfterError = sourceCommand._showHelpAfterError;
        this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
        return this;
      }
      /**
       * @returns {Command[]}
       * @private
       */
      _getCommandAndAncestors() {
        const result = [];
        for (let command = this; command; command = command.parent) {
          result.push(command);
        }
        return result;
      }
      /**
       * Define a command.
       *
       * There are two styles of command: pay attention to where to put the description.
       *
       * @example
       * // Command implemented using action handler (description is supplied separately to `.command`)
       * program
       *   .command('clone <source> [destination]')
       *   .description('clone a repository into a newly created directory')
       *   .action((source, destination) => {
       *     console.log('clone command called');
       *   });
       *
       * // Command implemented using separate executable file (description is second parameter to `.command`)
       * program
       *   .command('start <service>', 'start named service')
       *   .command('stop [service]', 'stop named service, or all if no name supplied');
       *
       * @param {string} nameAndArgs - command name and arguments, args are `<required>` or `[optional]` and last may also be `variadic...`
       * @param {(object | string)} [actionOptsOrExecDesc] - configuration options (for action), or description (for executable)
       * @param {object} [execOpts] - configuration options (for executable)
       * @return {Command} returns new command for action handler, or `this` for executable command
       */
      command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
        let desc = actionOptsOrExecDesc;
        let opts = execOpts;
        if (typeof desc === "object" && desc !== null) {
          opts = desc;
          desc = null;
        }
        opts = opts || {};
        const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
        const cmd = this.createCommand(name);
        if (desc) {
          cmd.description(desc);
          cmd._executableHandler = true;
        }
        if (opts.isDefault)
          this._defaultCommandName = cmd._name;
        cmd._hidden = !!(opts.noHelp || opts.hidden);
        cmd._executableFile = opts.executableFile || null;
        if (args)
          cmd.arguments(args);
        this._registerCommand(cmd);
        cmd.parent = this;
        cmd.copyInheritedSettings(this);
        if (desc)
          return this;
        return cmd;
      }
      /**
       * Factory routine to create a new unattached command.
       *
       * See .command() for creating an attached subcommand, which uses this routine to
       * create the command. You can override createCommand to customise subcommands.
       *
       * @param {string} [name]
       * @return {Command} new command
       */
      createCommand(name) {
        return new Command2(name);
      }
      /**
       * You can customise the help with a subclass of Help by overriding createHelp,
       * or by overriding Help properties using configureHelp().
       *
       * @return {Help}
       */
      createHelp() {
        return Object.assign(new Help2(), this.configureHelp());
      }
      /**
       * You can customise the help by overriding Help properties using configureHelp(),
       * or with a subclass of Help by overriding createHelp().
       *
       * @param {object} [configuration] - configuration options
       * @return {(Command | object)} `this` command for chaining, or stored configuration
       */
      configureHelp(configuration) {
        if (configuration === void 0)
          return this._helpConfiguration;
        this._helpConfiguration = configuration;
        return this;
      }
      /**
       * The default output goes to stdout and stderr. You can customise this for special
       * applications. You can also customise the display of errors by overriding outputError.
       *
       * The configuration properties are all functions:
       *
       *     // functions to change where being written, stdout and stderr
       *     writeOut(str)
       *     writeErr(str)
       *     // matching functions to specify width for wrapping help
       *     getOutHelpWidth()
       *     getErrHelpWidth()
       *     // functions based on what is being written out
       *     outputError(str, write) // used for displaying errors, and not used for displaying help
       *
       * @param {object} [configuration] - configuration options
       * @return {(Command | object)} `this` command for chaining, or stored configuration
       */
      configureOutput(configuration) {
        if (configuration === void 0)
          return this._outputConfiguration;
        Object.assign(this._outputConfiguration, configuration);
        return this;
      }
      /**
       * Display the help or a custom message after an error occurs.
       *
       * @param {(boolean|string)} [displayHelp]
       * @return {Command} `this` command for chaining
       */
      showHelpAfterError(displayHelp = true) {
        if (typeof displayHelp !== "string")
          displayHelp = !!displayHelp;
        this._showHelpAfterError = displayHelp;
        return this;
      }
      /**
       * Display suggestion of similar commands for unknown commands, or options for unknown options.
       *
       * @param {boolean} [displaySuggestion]
       * @return {Command} `this` command for chaining
       */
      showSuggestionAfterError(displaySuggestion = true) {
        this._showSuggestionAfterError = !!displaySuggestion;
        return this;
      }
      /**
       * Add a prepared subcommand.
       *
       * See .command() for creating an attached subcommand which inherits settings from its parent.
       *
       * @param {Command} cmd - new subcommand
       * @param {object} [opts] - configuration options
       * @return {Command} `this` command for chaining
       */
      addCommand(cmd, opts) {
        if (!cmd._name) {
          throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
        }
        opts = opts || {};
        if (opts.isDefault)
          this._defaultCommandName = cmd._name;
        if (opts.noHelp || opts.hidden)
          cmd._hidden = true;
        this._registerCommand(cmd);
        cmd.parent = this;
        cmd._checkForBrokenPassThrough();
        return this;
      }
      /**
       * Factory routine to create a new unattached argument.
       *
       * See .argument() for creating an attached argument, which uses this routine to
       * create the argument. You can override createArgument to return a custom argument.
       *
       * @param {string} name
       * @param {string} [description]
       * @return {Argument} new argument
       */
      createArgument(name, description) {
        return new Argument2(name, description);
      }
      /**
       * Define argument syntax for command.
       *
       * The default is that the argument is required, and you can explicitly
       * indicate this with <> around the name. Put [] around the name for an optional argument.
       *
       * @example
       * program.argument('<input-file>');
       * program.argument('[output-file]');
       *
       * @param {string} name
       * @param {string} [description]
       * @param {(Function|*)} [fn] - custom argument processing function
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      argument(name, description, fn, defaultValue) {
        const argument = this.createArgument(name, description);
        if (typeof fn === "function") {
          argument.default(defaultValue).argParser(fn);
        } else {
          argument.default(fn);
        }
        this.addArgument(argument);
        return this;
      }
      /**
       * Define argument syntax for command, adding multiple at once (without descriptions).
       *
       * See also .argument().
       *
       * @example
       * program.arguments('<cmd> [env]');
       *
       * @param {string} names
       * @return {Command} `this` command for chaining
       */
      arguments(names) {
        names.trim().split(/ +/).forEach((detail) => {
          this.argument(detail);
        });
        return this;
      }
      /**
       * Define argument syntax for command, adding a prepared argument.
       *
       * @param {Argument} argument
       * @return {Command} `this` command for chaining
       */
      addArgument(argument) {
        const previousArgument = this.registeredArguments.slice(-1)[0];
        if (previousArgument && previousArgument.variadic) {
          throw new Error(
            `only the last argument can be variadic '${previousArgument.name()}'`
          );
        }
        if (argument.required && argument.defaultValue !== void 0 && argument.parseArg === void 0) {
          throw new Error(
            `a default value for a required argument is never used: '${argument.name()}'`
          );
        }
        this.registeredArguments.push(argument);
        return this;
      }
      /**
       * Customise or override default help command. By default a help command is automatically added if your command has subcommands.
       *
       * @example
       *    program.helpCommand('help [cmd]');
       *    program.helpCommand('help [cmd]', 'show help');
       *    program.helpCommand(false); // suppress default help command
       *    program.helpCommand(true); // add help command even if no subcommands
       *
       * @param {string|boolean} enableOrNameAndArgs - enable with custom name and/or arguments, or boolean to override whether added
       * @param {string} [description] - custom description
       * @return {Command} `this` command for chaining
       */
      helpCommand(enableOrNameAndArgs, description) {
        if (typeof enableOrNameAndArgs === "boolean") {
          this._addImplicitHelpCommand = enableOrNameAndArgs;
          return this;
        }
        enableOrNameAndArgs = enableOrNameAndArgs ?? "help [command]";
        const [, helpName, helpArgs] = enableOrNameAndArgs.match(/([^ ]+) *(.*)/);
        const helpDescription = description ?? "display help for command";
        const helpCommand = this.createCommand(helpName);
        helpCommand.helpOption(false);
        if (helpArgs)
          helpCommand.arguments(helpArgs);
        if (helpDescription)
          helpCommand.description(helpDescription);
        this._addImplicitHelpCommand = true;
        this._helpCommand = helpCommand;
        return this;
      }
      /**
       * Add prepared custom help command.
       *
       * @param {(Command|string|boolean)} helpCommand - custom help command, or deprecated enableOrNameAndArgs as for `.helpCommand()`
       * @param {string} [deprecatedDescription] - deprecated custom description used with custom name only
       * @return {Command} `this` command for chaining
       */
      addHelpCommand(helpCommand, deprecatedDescription) {
        if (typeof helpCommand !== "object") {
          this.helpCommand(helpCommand, deprecatedDescription);
          return this;
        }
        this._addImplicitHelpCommand = true;
        this._helpCommand = helpCommand;
        return this;
      }
      /**
       * Lazy create help command.
       *
       * @return {(Command|null)}
       * @package
       */
      _getHelpCommand() {
        const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
        if (hasImplicitHelpCommand) {
          if (this._helpCommand === void 0) {
            this.helpCommand(void 0, void 0);
          }
          return this._helpCommand;
        }
        return null;
      }
      /**
       * Add hook for life cycle event.
       *
       * @param {string} event
       * @param {Function} listener
       * @return {Command} `this` command for chaining
       */
      hook(event, listener) {
        const allowedValues = ["preSubcommand", "preAction", "postAction"];
        if (!allowedValues.includes(event)) {
          throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
        }
        if (this._lifeCycleHooks[event]) {
          this._lifeCycleHooks[event].push(listener);
        } else {
          this._lifeCycleHooks[event] = [listener];
        }
        return this;
      }
      /**
       * Register callback to use as replacement for calling process.exit.
       *
       * @param {Function} [fn] optional callback which will be passed a CommanderError, defaults to throwing
       * @return {Command} `this` command for chaining
       */
      exitOverride(fn) {
        if (fn) {
          this._exitCallback = fn;
        } else {
          this._exitCallback = (err2) => {
            if (err2.code !== "commander.executeSubCommandAsync") {
              throw err2;
            } else {
            }
          };
        }
        return this;
      }
      /**
       * Call process.exit, and _exitCallback if defined.
       *
       * @param {number} exitCode exit code for using with process.exit
       * @param {string} code an id string representing the error
       * @param {string} message human-readable description of the error
       * @return never
       * @private
       */
      _exit(exitCode, code, message) {
        if (this._exitCallback) {
          this._exitCallback(new CommanderError2(exitCode, code, message));
        }
        process8.exit(exitCode);
      }
      /**
       * Register callback `fn` for the command.
       *
       * @example
       * program
       *   .command('serve')
       *   .description('start service')
       *   .action(function() {
       *      // do work here
       *   });
       *
       * @param {Function} fn
       * @return {Command} `this` command for chaining
       */
      action(fn) {
        const listener = (args) => {
          const expectedArgsCount = this.registeredArguments.length;
          const actionArgs = args.slice(0, expectedArgsCount);
          if (this._storeOptionsAsProperties) {
            actionArgs[expectedArgsCount] = this;
          } else {
            actionArgs[expectedArgsCount] = this.opts();
          }
          actionArgs.push(this);
          return fn.apply(this, actionArgs);
        };
        this._actionHandler = listener;
        return this;
      }
      /**
       * Factory routine to create a new unattached option.
       *
       * See .option() for creating an attached option, which uses this routine to
       * create the option. You can override createOption to return a custom option.
       *
       * @param {string} flags
       * @param {string} [description]
       * @return {Option} new option
       */
      createOption(flags, description) {
        return new Option2(flags, description);
      }
      /**
       * Wrap parseArgs to catch 'commander.invalidArgument'.
       *
       * @param {(Option | Argument)} target
       * @param {string} value
       * @param {*} previous
       * @param {string} invalidArgumentMessage
       * @private
       */
      _callParseArg(target, value, previous, invalidArgumentMessage) {
        try {
          return target.parseArg(value, previous);
        } catch (err2) {
          if (err2.code === "commander.invalidArgument") {
            const message = `${invalidArgumentMessage} ${err2.message}`;
            this.error(message, { exitCode: err2.exitCode, code: err2.code });
          }
          throw err2;
        }
      }
      /**
       * Check for option flag conflicts.
       * Register option if no conflicts found, or throw on conflict.
       *
       * @param {Option} option
       * @private
       */
      _registerOption(option) {
        const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
        if (matchingOption) {
          const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
          throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
        }
        this.options.push(option);
      }
      /**
       * Check for command name and alias conflicts with existing commands.
       * Register command if no conflicts found, or throw on conflict.
       *
       * @param {Command} command
       * @private
       */
      _registerCommand(command) {
        const knownBy = (cmd) => {
          return [cmd.name()].concat(cmd.aliases());
        };
        const alreadyUsed = knownBy(command).find(
          (name) => this._findCommand(name)
        );
        if (alreadyUsed) {
          const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
          const newCmd = knownBy(command).join("|");
          throw new Error(
            `cannot add command '${newCmd}' as already have command '${existingCmd}'`
          );
        }
        this.commands.push(command);
      }
      /**
       * Add an option.
       *
       * @param {Option} option
       * @return {Command} `this` command for chaining
       */
      addOption(option) {
        this._registerOption(option);
        const oname = option.name();
        const name = option.attributeName();
        if (option.negate) {
          const positiveLongFlag = option.long.replace(/^--no-/, "--");
          if (!this._findOption(positiveLongFlag)) {
            this.setOptionValueWithSource(
              name,
              option.defaultValue === void 0 ? true : option.defaultValue,
              "default"
            );
          }
        } else if (option.defaultValue !== void 0) {
          this.setOptionValueWithSource(name, option.defaultValue, "default");
        }
        const handleOptionValue = (val, invalidValueMessage, valueSource) => {
          if (val == null && option.presetArg !== void 0) {
            val = option.presetArg;
          }
          const oldValue = this.getOptionValue(name);
          if (val !== null && option.parseArg) {
            val = this._callParseArg(option, val, oldValue, invalidValueMessage);
          } else if (val !== null && option.variadic) {
            val = option._concatValue(val, oldValue);
          }
          if (val == null) {
            if (option.negate) {
              val = false;
            } else if (option.isBoolean() || option.optional) {
              val = true;
            } else {
              val = "";
            }
          }
          this.setOptionValueWithSource(name, val, valueSource);
        };
        this.on("option:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "cli");
        });
        if (option.envVar) {
          this.on("optionEnv:" + oname, (val) => {
            const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
            handleOptionValue(val, invalidValueMessage, "env");
          });
        }
        return this;
      }
      /**
       * Internal implementation shared by .option() and .requiredOption()
       *
       * @return {Command} `this` command for chaining
       * @private
       */
      _optionEx(config, flags, description, fn, defaultValue) {
        if (typeof flags === "object" && flags instanceof Option2) {
          throw new Error(
            "To add an Option object use addOption() instead of option() or requiredOption()"
          );
        }
        const option = this.createOption(flags, description);
        option.makeOptionMandatory(!!config.mandatory);
        if (typeof fn === "function") {
          option.default(defaultValue).argParser(fn);
        } else if (fn instanceof RegExp) {
          const regex = fn;
          fn = (val, def) => {
            const m = regex.exec(val);
            return m ? m[0] : def;
          };
          option.default(defaultValue).argParser(fn);
        } else {
          option.default(fn);
        }
        return this.addOption(option);
      }
      /**
       * Define option with `flags`, `description`, and optional argument parsing function or `defaultValue` or both.
       *
       * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space. A required
       * option-argument is indicated by `<>` and an optional option-argument by `[]`.
       *
       * See the README for more details, and see also addOption() and requiredOption().
       *
       * @example
       * program
       *     .option('-p, --pepper', 'add pepper')
       *     .option('-p, --pizza-type <TYPE>', 'type of pizza') // required option-argument
       *     .option('-c, --cheese [CHEESE]', 'add extra cheese', 'mozzarella') // optional option-argument with default
       *     .option('-t, --tip <VALUE>', 'add tip to purchase cost', parseFloat) // custom parse function
       *
       * @param {string} flags
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom option processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      option(flags, description, parseArg, defaultValue) {
        return this._optionEx({}, flags, description, parseArg, defaultValue);
      }
      /**
       * Add a required option which must have a value after parsing. This usually means
       * the option must be specified on the command line. (Otherwise the same as .option().)
       *
       * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space.
       *
       * @param {string} flags
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom option processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      requiredOption(flags, description, parseArg, defaultValue) {
        return this._optionEx(
          { mandatory: true },
          flags,
          description,
          parseArg,
          defaultValue
        );
      }
      /**
       * Alter parsing of short flags with optional values.
       *
       * @example
       * // for `.option('-f,--flag [value]'):
       * program.combineFlagAndOptionalValue(true);  // `-f80` is treated like `--flag=80`, this is the default behaviour
       * program.combineFlagAndOptionalValue(false) // `-fb` is treated like `-f -b`
       *
       * @param {boolean} [combine] - if `true` or omitted, an optional value can be specified directly after the flag.
       * @return {Command} `this` command for chaining
       */
      combineFlagAndOptionalValue(combine = true) {
        this._combineFlagAndOptionalValue = !!combine;
        return this;
      }
      /**
       * Allow unknown options on the command line.
       *
       * @param {boolean} [allowUnknown] - if `true` or omitted, no error will be thrown for unknown options.
       * @return {Command} `this` command for chaining
       */
      allowUnknownOption(allowUnknown = true) {
        this._allowUnknownOption = !!allowUnknown;
        return this;
      }
      /**
       * Allow excess command-arguments on the command line. Pass false to make excess arguments an error.
       *
       * @param {boolean} [allowExcess] - if `true` or omitted, no error will be thrown for excess arguments.
       * @return {Command} `this` command for chaining
       */
      allowExcessArguments(allowExcess = true) {
        this._allowExcessArguments = !!allowExcess;
        return this;
      }
      /**
       * Enable positional options. Positional means global options are specified before subcommands which lets
       * subcommands reuse the same option names, and also enables subcommands to turn on passThroughOptions.
       * The default behaviour is non-positional and global options may appear anywhere on the command line.
       *
       * @param {boolean} [positional]
       * @return {Command} `this` command for chaining
       */
      enablePositionalOptions(positional = true) {
        this._enablePositionalOptions = !!positional;
        return this;
      }
      /**
       * Pass through options that come after command-arguments rather than treat them as command-options,
       * so actual command-options come before command-arguments. Turning this on for a subcommand requires
       * positional options to have been enabled on the program (parent commands).
       * The default behaviour is non-positional and options may appear before or after command-arguments.
       *
       * @param {boolean} [passThrough] for unknown options.
       * @return {Command} `this` command for chaining
       */
      passThroughOptions(passThrough = true) {
        this._passThroughOptions = !!passThrough;
        this._checkForBrokenPassThrough();
        return this;
      }
      /**
       * @private
       */
      _checkForBrokenPassThrough() {
        if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
          throw new Error(
            `passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`
          );
        }
      }
      /**
       * Whether to store option values as properties on command object,
       * or store separately (specify false). In both cases the option values can be accessed using .opts().
       *
       * @param {boolean} [storeAsProperties=true]
       * @return {Command} `this` command for chaining
       */
      storeOptionsAsProperties(storeAsProperties = true) {
        if (this.options.length) {
          throw new Error("call .storeOptionsAsProperties() before adding options");
        }
        if (Object.keys(this._optionValues).length) {
          throw new Error(
            "call .storeOptionsAsProperties() before setting option values"
          );
        }
        this._storeOptionsAsProperties = !!storeAsProperties;
        return this;
      }
      /**
       * Retrieve option value.
       *
       * @param {string} key
       * @return {object} value
       */
      getOptionValue(key) {
        if (this._storeOptionsAsProperties) {
          return this[key];
        }
        return this._optionValues[key];
      }
      /**
       * Store option value.
       *
       * @param {string} key
       * @param {object} value
       * @return {Command} `this` command for chaining
       */
      setOptionValue(key, value) {
        return this.setOptionValueWithSource(key, value, void 0);
      }
      /**
       * Store option value and where the value came from.
       *
       * @param {string} key
       * @param {object} value
       * @param {string} source - expected values are default/config/env/cli/implied
       * @return {Command} `this` command for chaining
       */
      setOptionValueWithSource(key, value, source) {
        if (this._storeOptionsAsProperties) {
          this[key] = value;
        } else {
          this._optionValues[key] = value;
        }
        this._optionValueSources[key] = source;
        return this;
      }
      /**
       * Get source of option value.
       * Expected values are default | config | env | cli | implied
       *
       * @param {string} key
       * @return {string}
       */
      getOptionValueSource(key) {
        return this._optionValueSources[key];
      }
      /**
       * Get source of option value. See also .optsWithGlobals().
       * Expected values are default | config | env | cli | implied
       *
       * @param {string} key
       * @return {string}
       */
      getOptionValueSourceWithGlobals(key) {
        let source;
        this._getCommandAndAncestors().forEach((cmd) => {
          if (cmd.getOptionValueSource(key) !== void 0) {
            source = cmd.getOptionValueSource(key);
          }
        });
        return source;
      }
      /**
       * Get user arguments from implied or explicit arguments.
       * Side-effects: set _scriptPath if args included script. Used for default program name, and subcommand searches.
       *
       * @private
       */
      _prepareUserArgs(argv, parseOptions) {
        if (argv !== void 0 && !Array.isArray(argv)) {
          throw new Error("first parameter to parse must be array or undefined");
        }
        parseOptions = parseOptions || {};
        if (argv === void 0 && parseOptions.from === void 0) {
          if (process8.versions?.electron) {
            parseOptions.from = "electron";
          }
          const execArgv = process8.execArgv ?? [];
          if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
            parseOptions.from = "eval";
          }
        }
        if (argv === void 0) {
          argv = process8.argv;
        }
        this.rawArgs = argv.slice();
        let userArgs;
        switch (parseOptions.from) {
          case void 0:
          case "node":
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
            break;
          case "electron":
            if (process8.defaultApp) {
              this._scriptPath = argv[1];
              userArgs = argv.slice(2);
            } else {
              userArgs = argv.slice(1);
            }
            break;
          case "user":
            userArgs = argv.slice(0);
            break;
          case "eval":
            userArgs = argv.slice(1);
            break;
          default:
            throw new Error(
              `unexpected parse option { from: '${parseOptions.from}' }`
            );
        }
        if (!this._name && this._scriptPath)
          this.nameFromFilename(this._scriptPath);
        this._name = this._name || "program";
        return userArgs;
      }
      /**
       * Parse `argv`, setting options and invoking commands when defined.
       *
       * Use parseAsync instead of parse if any of your action handlers are async.
       *
       * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
       *
       * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
       * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
       * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
       * - `'user'`: just user arguments
       *
       * @example
       * program.parse(); // parse process.argv and auto-detect electron and special node flags
       * program.parse(process.argv); // assume argv[0] is app and argv[1] is script
       * program.parse(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
       *
       * @param {string[]} [argv] - optional, defaults to process.argv
       * @param {object} [parseOptions] - optionally specify style of options with from: node/user/electron
       * @param {string} [parseOptions.from] - where the args are from: 'node', 'user', 'electron'
       * @return {Command} `this` command for chaining
       */
      parse(argv, parseOptions) {
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        this._parseCommand([], userArgs);
        return this;
      }
      /**
       * Parse `argv`, setting options and invoking commands when defined.
       *
       * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
       *
       * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
       * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
       * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
       * - `'user'`: just user arguments
       *
       * @example
       * await program.parseAsync(); // parse process.argv and auto-detect electron and special node flags
       * await program.parseAsync(process.argv); // assume argv[0] is app and argv[1] is script
       * await program.parseAsync(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
       *
       * @param {string[]} [argv]
       * @param {object} [parseOptions]
       * @param {string} parseOptions.from - where the args are from: 'node', 'user', 'electron'
       * @return {Promise}
       */
      async parseAsync(argv, parseOptions) {
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        await this._parseCommand([], userArgs);
        return this;
      }
      /**
       * Execute a sub-command executable.
       *
       * @private
       */
      _executeSubCommand(subcommand, args) {
        args = args.slice();
        let launchWithNode = false;
        const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
        function findFile(baseDir, baseName) {
          const localBin = path6.resolve(baseDir, baseName);
          if (fs9.existsSync(localBin))
            return localBin;
          if (sourceExt.includes(path6.extname(baseName)))
            return void 0;
          const foundExt = sourceExt.find(
            (ext) => fs9.existsSync(`${localBin}${ext}`)
          );
          if (foundExt)
            return `${localBin}${foundExt}`;
          return void 0;
        }
        this._checkForMissingMandatoryOptions();
        this._checkForConflictingOptions();
        let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
        let executableDir = this._executableDir || "";
        if (this._scriptPath) {
          let resolvedScriptPath;
          try {
            resolvedScriptPath = fs9.realpathSync(this._scriptPath);
          } catch (err2) {
            resolvedScriptPath = this._scriptPath;
          }
          executableDir = path6.resolve(
            path6.dirname(resolvedScriptPath),
            executableDir
          );
        }
        if (executableDir) {
          let localFile = findFile(executableDir, executableFile);
          if (!localFile && !subcommand._executableFile && this._scriptPath) {
            const legacyName = path6.basename(
              this._scriptPath,
              path6.extname(this._scriptPath)
            );
            if (legacyName !== this._name) {
              localFile = findFile(
                executableDir,
                `${legacyName}-${subcommand._name}`
              );
            }
          }
          executableFile = localFile || executableFile;
        }
        launchWithNode = sourceExt.includes(path6.extname(executableFile));
        let proc;
        if (process8.platform !== "win32") {
          if (launchWithNode) {
            args.unshift(executableFile);
            args = incrementNodeInspectorPort(process8.execArgv).concat(args);
            proc = childProcess2.spawn(process8.argv[0], args, { stdio: "inherit" });
          } else {
            proc = childProcess2.spawn(executableFile, args, { stdio: "inherit" });
          }
        } else {
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process8.execArgv).concat(args);
          proc = childProcess2.spawn(process8.execPath, args, { stdio: "inherit" });
        }
        if (!proc.killed) {
          const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
          signals.forEach((signal) => {
            process8.on(signal, () => {
              if (proc.killed === false && proc.exitCode === null) {
                proc.kill(signal);
              }
            });
          });
        }
        const exitCallback = this._exitCallback;
        proc.on("close", (code) => {
          code = code ?? 1;
          if (!exitCallback) {
            process8.exit(code);
          } else {
            exitCallback(
              new CommanderError2(
                code,
                "commander.executeSubCommandAsync",
                "(close)"
              )
            );
          }
        });
        proc.on("error", (err2) => {
          if (err2.code === "ENOENT") {
            const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
            const executableMissing = `'${executableFile}' does not exist
 - if '${subcommand._name}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
            throw new Error(executableMissing);
          } else if (err2.code === "EACCES") {
            throw new Error(`'${executableFile}' not executable`);
          }
          if (!exitCallback) {
            process8.exit(1);
          } else {
            const wrappedError = new CommanderError2(
              1,
              "commander.executeSubCommandAsync",
              "(error)"
            );
            wrappedError.nestedError = err2;
            exitCallback(wrappedError);
          }
        });
        this.runningCommand = proc;
      }
      /**
       * @private
       */
      _dispatchSubcommand(commandName, operands, unknown) {
        const subCommand = this._findCommand(commandName);
        if (!subCommand)
          this.help({ error: true });
        let promiseChain;
        promiseChain = this._chainOrCallSubCommandHook(
          promiseChain,
          subCommand,
          "preSubcommand"
        );
        promiseChain = this._chainOrCall(promiseChain, () => {
          if (subCommand._executableHandler) {
            this._executeSubCommand(subCommand, operands.concat(unknown));
          } else {
            return subCommand._parseCommand(operands, unknown);
          }
        });
        return promiseChain;
      }
      /**
       * Invoke help directly if possible, or dispatch if necessary.
       * e.g. help foo
       *
       * @private
       */
      _dispatchHelpCommand(subcommandName) {
        if (!subcommandName) {
          this.help();
        }
        const subCommand = this._findCommand(subcommandName);
        if (subCommand && !subCommand._executableHandler) {
          subCommand.help();
        }
        return this._dispatchSubcommand(
          subcommandName,
          [],
          [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]
        );
      }
      /**
       * Check this.args against expected this.registeredArguments.
       *
       * @private
       */
      _checkNumberOfArguments() {
        this.registeredArguments.forEach((arg, i) => {
          if (arg.required && this.args[i] == null) {
            this.missingArgument(arg.name());
          }
        });
        if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
          return;
        }
        if (this.args.length > this.registeredArguments.length) {
          this._excessArguments(this.args);
        }
      }
      /**
       * Process this.args using this.registeredArguments and save as this.processedArgs!
       *
       * @private
       */
      _processArguments() {
        const myParseArg = (argument, value, previous) => {
          let parsedValue = value;
          if (value !== null && argument.parseArg) {
            const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
            parsedValue = this._callParseArg(
              argument,
              value,
              previous,
              invalidValueMessage
            );
          }
          return parsedValue;
        };
        this._checkNumberOfArguments();
        const processedArgs = [];
        this.registeredArguments.forEach((declaredArg, index) => {
          let value = declaredArg.defaultValue;
          if (declaredArg.variadic) {
            if (index < this.args.length) {
              value = this.args.slice(index);
              if (declaredArg.parseArg) {
                value = value.reduce((processed, v) => {
                  return myParseArg(declaredArg, v, processed);
                }, declaredArg.defaultValue);
              }
            } else if (value === void 0) {
              value = [];
            }
          } else if (index < this.args.length) {
            value = this.args[index];
            if (declaredArg.parseArg) {
              value = myParseArg(declaredArg, value, declaredArg.defaultValue);
            }
          }
          processedArgs[index] = value;
        });
        this.processedArgs = processedArgs;
      }
      /**
       * Once we have a promise we chain, but call synchronously until then.
       *
       * @param {(Promise|undefined)} promise
       * @param {Function} fn
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCall(promise, fn) {
        if (promise && promise.then && typeof promise.then === "function") {
          return promise.then(() => fn());
        }
        return fn();
      }
      /**
       *
       * @param {(Promise|undefined)} promise
       * @param {string} event
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCallHooks(promise, event) {
        let result = promise;
        const hooks = [];
        this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== void 0).forEach((hookedCommand) => {
          hookedCommand._lifeCycleHooks[event].forEach((callback) => {
            hooks.push({ hookedCommand, callback });
          });
        });
        if (event === "postAction") {
          hooks.reverse();
        }
        hooks.forEach((hookDetail) => {
          result = this._chainOrCall(result, () => {
            return hookDetail.callback(hookDetail.hookedCommand, this);
          });
        });
        return result;
      }
      /**
       *
       * @param {(Promise|undefined)} promise
       * @param {Command} subCommand
       * @param {string} event
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCallSubCommandHook(promise, subCommand, event) {
        let result = promise;
        if (this._lifeCycleHooks[event] !== void 0) {
          this._lifeCycleHooks[event].forEach((hook) => {
            result = this._chainOrCall(result, () => {
              return hook(this, subCommand);
            });
          });
        }
        return result;
      }
      /**
       * Process arguments in context of this command.
       * Returns action result, in case it is a promise.
       *
       * @private
       */
      _parseCommand(operands, unknown) {
        const parsed = this.parseOptions(unknown);
        this._parseOptionsEnv();
        this._parseOptionsImplied();
        operands = operands.concat(parsed.operands);
        unknown = parsed.unknown;
        this.args = operands.concat(unknown);
        if (operands && this._findCommand(operands[0])) {
          return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
        }
        if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
          return this._dispatchHelpCommand(operands[1]);
        }
        if (this._defaultCommandName) {
          this._outputHelpIfRequested(unknown);
          return this._dispatchSubcommand(
            this._defaultCommandName,
            operands,
            unknown
          );
        }
        if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
          this.help({ error: true });
        }
        this._outputHelpIfRequested(parsed.unknown);
        this._checkForMissingMandatoryOptions();
        this._checkForConflictingOptions();
        const checkForUnknownOptions = () => {
          if (parsed.unknown.length > 0) {
            this.unknownOption(parsed.unknown[0]);
          }
        };
        const commandEvent = `command:${this.name()}`;
        if (this._actionHandler) {
          checkForUnknownOptions();
          this._processArguments();
          let promiseChain;
          promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
          promiseChain = this._chainOrCall(
            promiseChain,
            () => this._actionHandler(this.processedArgs)
          );
          if (this.parent) {
            promiseChain = this._chainOrCall(promiseChain, () => {
              this.parent.emit(commandEvent, operands, unknown);
            });
          }
          promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
          return promiseChain;
        }
        if (this.parent && this.parent.listenerCount(commandEvent)) {
          checkForUnknownOptions();
          this._processArguments();
          this.parent.emit(commandEvent, operands, unknown);
        } else if (operands.length) {
          if (this._findCommand("*")) {
            return this._dispatchSubcommand("*", operands, unknown);
          }
          if (this.listenerCount("command:*")) {
            this.emit("command:*", operands, unknown);
          } else if (this.commands.length) {
            this.unknownCommand();
          } else {
            checkForUnknownOptions();
            this._processArguments();
          }
        } else if (this.commands.length) {
          checkForUnknownOptions();
          this.help({ error: true });
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      }
      /**
       * Find matching command.
       *
       * @private
       * @return {Command | undefined}
       */
      _findCommand(name) {
        if (!name)
          return void 0;
        return this.commands.find(
          (cmd) => cmd._name === name || cmd._aliases.includes(name)
        );
      }
      /**
       * Return an option matching `arg` if any.
       *
       * @param {string} arg
       * @return {Option}
       * @package
       */
      _findOption(arg) {
        return this.options.find((option) => option.is(arg));
      }
      /**
       * Display an error message if a mandatory option does not have a value.
       * Called after checking for help flags in leaf subcommand.
       *
       * @private
       */
      _checkForMissingMandatoryOptions() {
        this._getCommandAndAncestors().forEach((cmd) => {
          cmd.options.forEach((anOption) => {
            if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === void 0) {
              cmd.missingMandatoryOptionValue(anOption);
            }
          });
        });
      }
      /**
       * Display an error message if conflicting options are used together in this.
       *
       * @private
       */
      _checkForConflictingLocalOptions() {
        const definedNonDefaultOptions = this.options.filter((option) => {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === void 0) {
            return false;
          }
          return this.getOptionValueSource(optionKey) !== "default";
        });
        const optionsWithConflicting = definedNonDefaultOptions.filter(
          (option) => option.conflictsWith.length > 0
        );
        optionsWithConflicting.forEach((option) => {
          const conflictingAndDefined = definedNonDefaultOptions.find(
            (defined) => option.conflictsWith.includes(defined.attributeName())
          );
          if (conflictingAndDefined) {
            this._conflictingOption(option, conflictingAndDefined);
          }
        });
      }
      /**
       * Display an error message if conflicting options are used together.
       * Called after checking for help flags in leaf subcommand.
       *
       * @private
       */
      _checkForConflictingOptions() {
        this._getCommandAndAncestors().forEach((cmd) => {
          cmd._checkForConflictingLocalOptions();
        });
      }
      /**
       * Parse options from `argv` removing known options,
       * and return argv split into operands and unknown arguments.
       *
       * Examples:
       *
       *     argv => operands, unknown
       *     --known kkk op => [op], []
       *     op --known kkk => [op], []
       *     sub --unknown uuu op => [sub], [--unknown uuu op]
       *     sub -- --unknown uuu op => [sub --unknown uuu op], []
       *
       * @param {string[]} argv
       * @return {{operands: string[], unknown: string[]}}
       */
      parseOptions(argv) {
        const operands = [];
        const unknown = [];
        let dest = operands;
        const args = argv.slice();
        function maybeOption(arg) {
          return arg.length > 1 && arg[0] === "-";
        }
        let activeVariadicOption = null;
        while (args.length) {
          const arg = args.shift();
          if (arg === "--") {
            if (dest === unknown)
              dest.push(arg);
            dest.push(...args);
            break;
          }
          if (activeVariadicOption && !maybeOption(arg)) {
            this.emit(`option:${activeVariadicOption.name()}`, arg);
            continue;
          }
          activeVariadicOption = null;
          if (maybeOption(arg)) {
            const option = this._findOption(arg);
            if (option) {
              if (option.required) {
                const value = args.shift();
                if (value === void 0)
                  this.optionMissingArgument(option);
                this.emit(`option:${option.name()}`, value);
              } else if (option.optional) {
                let value = null;
                if (args.length > 0 && !maybeOption(args[0])) {
                  value = args.shift();
                }
                this.emit(`option:${option.name()}`, value);
              } else {
                this.emit(`option:${option.name()}`);
              }
              activeVariadicOption = option.variadic ? option : null;
              continue;
            }
          }
          if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
            const option = this._findOption(`-${arg[1]}`);
            if (option) {
              if (option.required || option.optional && this._combineFlagAndOptionalValue) {
                this.emit(`option:${option.name()}`, arg.slice(2));
              } else {
                this.emit(`option:${option.name()}`);
                args.unshift(`-${arg.slice(2)}`);
              }
              continue;
            }
          }
          if (/^--[^=]+=/.test(arg)) {
            const index = arg.indexOf("=");
            const option = this._findOption(arg.slice(0, index));
            if (option && (option.required || option.optional)) {
              this.emit(`option:${option.name()}`, arg.slice(index + 1));
              continue;
            }
          }
          if (maybeOption(arg)) {
            dest = unknown;
          }
          if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
            if (this._findCommand(arg)) {
              operands.push(arg);
              if (args.length > 0)
                unknown.push(...args);
              break;
            } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
              operands.push(arg);
              if (args.length > 0)
                operands.push(...args);
              break;
            } else if (this._defaultCommandName) {
              unknown.push(arg);
              if (args.length > 0)
                unknown.push(...args);
              break;
            }
          }
          if (this._passThroughOptions) {
            dest.push(arg);
            if (args.length > 0)
              dest.push(...args);
            break;
          }
          dest.push(arg);
        }
        return { operands, unknown };
      }
      /**
       * Return an object containing local option values as key-value pairs.
       *
       * @return {object}
       */
      opts() {
        if (this._storeOptionsAsProperties) {
          const result = {};
          const len = this.options.length;
          for (let i = 0; i < len; i++) {
            const key = this.options[i].attributeName();
            result[key] = key === this._versionOptionName ? this._version : this[key];
          }
          return result;
        }
        return this._optionValues;
      }
      /**
       * Return an object containing merged local and global option values as key-value pairs.
       *
       * @return {object}
       */
      optsWithGlobals() {
        return this._getCommandAndAncestors().reduce(
          (combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()),
          {}
        );
      }
      /**
       * Display error message and exit (or call exitOverride).
       *
       * @param {string} message
       * @param {object} [errorOptions]
       * @param {string} [errorOptions.code] - an id string representing the error
       * @param {number} [errorOptions.exitCode] - used with process.exit
       */
      error(message, errorOptions) {
        this._outputConfiguration.outputError(
          `${message}
`,
          this._outputConfiguration.writeErr
        );
        if (typeof this._showHelpAfterError === "string") {
          this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
        } else if (this._showHelpAfterError) {
          this._outputConfiguration.writeErr("\n");
          this.outputHelp({ error: true });
        }
        const config = errorOptions || {};
        const exitCode = config.exitCode || 1;
        const code = config.code || "commander.error";
        this._exit(exitCode, code, message);
      }
      /**
       * Apply any option related environment variables, if option does
       * not have a value from cli or client code.
       *
       * @private
       */
      _parseOptionsEnv() {
        this.options.forEach((option) => {
          if (option.envVar && option.envVar in process8.env) {
            const optionKey = option.attributeName();
            if (this.getOptionValue(optionKey) === void 0 || ["default", "config", "env"].includes(
              this.getOptionValueSource(optionKey)
            )) {
              if (option.required || option.optional) {
                this.emit(`optionEnv:${option.name()}`, process8.env[option.envVar]);
              } else {
                this.emit(`optionEnv:${option.name()}`);
              }
            }
          }
        });
      }
      /**
       * Apply any implied option values, if option is undefined or default value.
       *
       * @private
       */
      _parseOptionsImplied() {
        const dualHelper = new DualOptions(this.options);
        const hasCustomOptionValue = (optionKey) => {
          return this.getOptionValue(optionKey) !== void 0 && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
        };
        this.options.filter(
          (option) => option.implied !== void 0 && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(
            this.getOptionValue(option.attributeName()),
            option
          )
        ).forEach((option) => {
          Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
            this.setOptionValueWithSource(
              impliedKey,
              option.implied[impliedKey],
              "implied"
            );
          });
        });
      }
      /**
       * Argument `name` is missing.
       *
       * @param {string} name
       * @private
       */
      missingArgument(name) {
        const message = `error: missing required argument '${name}'`;
        this.error(message, { code: "commander.missingArgument" });
      }
      /**
       * `Option` is missing an argument.
       *
       * @param {Option} option
       * @private
       */
      optionMissingArgument(option) {
        const message = `error: option '${option.flags}' argument missing`;
        this.error(message, { code: "commander.optionMissingArgument" });
      }
      /**
       * `Option` does not have a value, and is a mandatory option.
       *
       * @param {Option} option
       * @private
       */
      missingMandatoryOptionValue(option) {
        const message = `error: required option '${option.flags}' not specified`;
        this.error(message, { code: "commander.missingMandatoryOptionValue" });
      }
      /**
       * `Option` conflicts with another option.
       *
       * @param {Option} option
       * @param {Option} conflictingOption
       * @private
       */
      _conflictingOption(option, conflictingOption) {
        const findBestOptionFromValue = (option2) => {
          const optionKey = option2.attributeName();
          const optionValue = this.getOptionValue(optionKey);
          const negativeOption = this.options.find(
            (target) => target.negate && optionKey === target.attributeName()
          );
          const positiveOption = this.options.find(
            (target) => !target.negate && optionKey === target.attributeName()
          );
          if (negativeOption && (negativeOption.presetArg === void 0 && optionValue === false || negativeOption.presetArg !== void 0 && optionValue === negativeOption.presetArg)) {
            return negativeOption;
          }
          return positiveOption || option2;
        };
        const getErrorMessage = (option2) => {
          const bestOption = findBestOptionFromValue(option2);
          const optionKey = bestOption.attributeName();
          const source = this.getOptionValueSource(optionKey);
          if (source === "env") {
            return `environment variable '${bestOption.envVar}'`;
          }
          return `option '${bestOption.flags}'`;
        };
        const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
        this.error(message, { code: "commander.conflictingOption" });
      }
      /**
       * Unknown option `flag`.
       *
       * @param {string} flag
       * @private
       */
      unknownOption(flag) {
        if (this._allowUnknownOption)
          return;
        let suggestion = "";
        if (flag.startsWith("--") && this._showSuggestionAfterError) {
          let candidateFlags = [];
          let command = this;
          do {
            const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
            candidateFlags = candidateFlags.concat(moreFlags);
            command = command.parent;
          } while (command && !command._enablePositionalOptions);
          suggestion = suggestSimilar(flag, candidateFlags);
        }
        const message = `error: unknown option '${flag}'${suggestion}`;
        this.error(message, { code: "commander.unknownOption" });
      }
      /**
       * Excess arguments, more than expected.
       *
       * @param {string[]} receivedArgs
       * @private
       */
      _excessArguments(receivedArgs) {
        if (this._allowExcessArguments)
          return;
        const expected = this.registeredArguments.length;
        const s = expected === 1 ? "" : "s";
        const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
        const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
        this.error(message, { code: "commander.excessArguments" });
      }
      /**
       * Unknown command.
       *
       * @private
       */
      unknownCommand() {
        const unknownName = this.args[0];
        let suggestion = "";
        if (this._showSuggestionAfterError) {
          const candidateNames = [];
          this.createHelp().visibleCommands(this).forEach((command) => {
            candidateNames.push(command.name());
            if (command.alias())
              candidateNames.push(command.alias());
          });
          suggestion = suggestSimilar(unknownName, candidateNames);
        }
        const message = `error: unknown command '${unknownName}'${suggestion}`;
        this.error(message, { code: "commander.unknownCommand" });
      }
      /**
       * Get or set the program version.
       *
       * This method auto-registers the "-V, --version" option which will print the version number.
       *
       * You can optionally supply the flags and description to override the defaults.
       *
       * @param {string} [str]
       * @param {string} [flags]
       * @param {string} [description]
       * @return {(this | string | undefined)} `this` command for chaining, or version string if no arguments
       */
      version(str, flags, description) {
        if (str === void 0)
          return this._version;
        this._version = str;
        flags = flags || "-V, --version";
        description = description || "output the version number";
        const versionOption = this.createOption(flags, description);
        this._versionOptionName = versionOption.attributeName();
        this._registerOption(versionOption);
        this.on("option:" + versionOption.name(), () => {
          this._outputConfiguration.writeOut(`${str}
`);
          this._exit(0, "commander.version", str);
        });
        return this;
      }
      /**
       * Set the description.
       *
       * @param {string} [str]
       * @param {object} [argsDescription]
       * @return {(string|Command)}
       */
      description(str, argsDescription) {
        if (str === void 0 && argsDescription === void 0)
          return this._description;
        this._description = str;
        if (argsDescription) {
          this._argsDescription = argsDescription;
        }
        return this;
      }
      /**
       * Set the summary. Used when listed as subcommand of parent.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      summary(str) {
        if (str === void 0)
          return this._summary;
        this._summary = str;
        return this;
      }
      /**
       * Set an alias for the command.
       *
       * You may call more than once to add multiple aliases. Only the first alias is shown in the auto-generated help.
       *
       * @param {string} [alias]
       * @return {(string|Command)}
       */
      alias(alias) {
        if (alias === void 0)
          return this._aliases[0];
        let command = this;
        if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
          command = this.commands[this.commands.length - 1];
        }
        if (alias === command._name)
          throw new Error("Command alias can't be the same as its name");
        const matchingCommand = this.parent?._findCommand(alias);
        if (matchingCommand) {
          const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
          throw new Error(
            `cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`
          );
        }
        command._aliases.push(alias);
        return this;
      }
      /**
       * Set aliases for the command.
       *
       * Only the first alias is shown in the auto-generated help.
       *
       * @param {string[]} [aliases]
       * @return {(string[]|Command)}
       */
      aliases(aliases2) {
        if (aliases2 === void 0)
          return this._aliases;
        aliases2.forEach((alias) => this.alias(alias));
        return this;
      }
      /**
       * Set / get the command usage `str`.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      usage(str) {
        if (str === void 0) {
          if (this._usage)
            return this._usage;
          const args = this.registeredArguments.map((arg) => {
            return humanReadableArgName(arg);
          });
          return [].concat(
            this.options.length || this._helpOption !== null ? "[options]" : [],
            this.commands.length ? "[command]" : [],
            this.registeredArguments.length ? args : []
          ).join(" ");
        }
        this._usage = str;
        return this;
      }
      /**
       * Get or set the name of the command.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      name(str) {
        if (str === void 0)
          return this._name;
        this._name = str;
        return this;
      }
      /**
       * Set the name of the command from script filename, such as process.argv[1],
       * or require.main.filename, or __filename.
       *
       * (Used internally and public although not documented in README.)
       *
       * @example
       * program.nameFromFilename(require.main.filename);
       *
       * @param {string} filename
       * @return {Command}
       */
      nameFromFilename(filename) {
        this._name = path6.basename(filename, path6.extname(filename));
        return this;
      }
      /**
       * Get or set the directory for searching for executable subcommands of this command.
       *
       * @example
       * program.executableDir(__dirname);
       * // or
       * program.executableDir('subcommands');
       *
       * @param {string} [path]
       * @return {(string|null|Command)}
       */
      executableDir(path7) {
        if (path7 === void 0)
          return this._executableDir;
        this._executableDir = path7;
        return this;
      }
      /**
       * Return program help documentation.
       *
       * @param {{ error: boolean }} [contextOptions] - pass {error:true} to wrap for stderr instead of stdout
       * @return {string}
       */
      helpInformation(contextOptions) {
        const helper = this.createHelp();
        if (helper.helpWidth === void 0) {
          helper.helpWidth = contextOptions && contextOptions.error ? this._outputConfiguration.getErrHelpWidth() : this._outputConfiguration.getOutHelpWidth();
        }
        return helper.formatHelp(this, helper);
      }
      /**
       * @private
       */
      _getHelpContext(contextOptions) {
        contextOptions = contextOptions || {};
        const context = { error: !!contextOptions.error };
        let write;
        if (context.error) {
          write = (arg) => this._outputConfiguration.writeErr(arg);
        } else {
          write = (arg) => this._outputConfiguration.writeOut(arg);
        }
        context.write = contextOptions.write || write;
        context.command = this;
        return context;
      }
      /**
       * Output help information for this command.
       *
       * Outputs built-in help, and custom text added using `.addHelpText()`.
       *
       * @param {{ error: boolean } | Function} [contextOptions] - pass {error:true} to write to stderr instead of stdout
       */
      outputHelp(contextOptions) {
        let deprecatedCallback;
        if (typeof contextOptions === "function") {
          deprecatedCallback = contextOptions;
          contextOptions = void 0;
        }
        const context = this._getHelpContext(contextOptions);
        this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", context));
        this.emit("beforeHelp", context);
        let helpInformation = this.helpInformation(context);
        if (deprecatedCallback) {
          helpInformation = deprecatedCallback(helpInformation);
          if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
            throw new Error("outputHelp callback must return a string or a Buffer");
          }
        }
        context.write(helpInformation);
        if (this._getHelpOption()?.long) {
          this.emit(this._getHelpOption().long);
        }
        this.emit("afterHelp", context);
        this._getCommandAndAncestors().forEach(
          (command) => command.emit("afterAllHelp", context)
        );
      }
      /**
       * You can pass in flags and a description to customise the built-in help option.
       * Pass in false to disable the built-in help option.
       *
       * @example
       * program.helpOption('-?, --help' 'show help'); // customise
       * program.helpOption(false); // disable
       *
       * @param {(string | boolean)} flags
       * @param {string} [description]
       * @return {Command} `this` command for chaining
       */
      helpOption(flags, description) {
        if (typeof flags === "boolean") {
          if (flags) {
            this._helpOption = this._helpOption ?? void 0;
          } else {
            this._helpOption = null;
          }
          return this;
        }
        flags = flags ?? "-h, --help";
        description = description ?? "display help for command";
        this._helpOption = this.createOption(flags, description);
        return this;
      }
      /**
       * Lazy create help option.
       * Returns null if has been disabled with .helpOption(false).
       *
       * @returns {(Option | null)} the help option
       * @package
       */
      _getHelpOption() {
        if (this._helpOption === void 0) {
          this.helpOption(void 0, void 0);
        }
        return this._helpOption;
      }
      /**
       * Supply your own option to use for the built-in help option.
       * This is an alternative to using helpOption() to customise the flags and description etc.
       *
       * @param {Option} option
       * @return {Command} `this` command for chaining
       */
      addHelpOption(option) {
        this._helpOption = option;
        return this;
      }
      /**
       * Output help information and exit.
       *
       * Outputs built-in help, and custom text added using `.addHelpText()`.
       *
       * @param {{ error: boolean }} [contextOptions] - pass {error:true} to write to stderr instead of stdout
       */
      help(contextOptions) {
        this.outputHelp(contextOptions);
        let exitCode = process8.exitCode || 0;
        if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
          exitCode = 1;
        }
        this._exit(exitCode, "commander.help", "(outputHelp)");
      }
      /**
       * Add additional text to be displayed with the built-in help.
       *
       * Position is 'before' or 'after' to affect just this command,
       * and 'beforeAll' or 'afterAll' to affect this command and all its subcommands.
       *
       * @param {string} position - before or after built-in help
       * @param {(string | Function)} text - string to add, or a function returning a string
       * @return {Command} `this` command for chaining
       */
      addHelpText(position, text) {
        const allowedValues = ["beforeAll", "before", "after", "afterAll"];
        if (!allowedValues.includes(position)) {
          throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
        }
        const helpEvent = `${position}Help`;
        this.on(helpEvent, (context) => {
          let helpStr;
          if (typeof text === "function") {
            helpStr = text({ error: context.error, command: context.command });
          } else {
            helpStr = text;
          }
          if (helpStr) {
            context.write(`${helpStr}
`);
          }
        });
        return this;
      }
      /**
       * Output help information if help flags specified
       *
       * @param {Array} args - array of options to search for help flags
       * @private
       */
      _outputHelpIfRequested(args) {
        const helpOption = this._getHelpOption();
        const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
        if (helpRequested) {
          this.outputHelp();
          this._exit(0, "commander.helpDisplayed", "(outputHelp)");
        }
      }
    };
    function incrementNodeInspectorPort(args) {
      return args.map((arg) => {
        if (!arg.startsWith("--inspect")) {
          return arg;
        }
        let debugOption;
        let debugHost = "127.0.0.1";
        let debugPort = "9229";
        let match;
        if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
          debugOption = match[1];
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
          debugOption = match[1];
          if (/^\d+$/.test(match[3])) {
            debugPort = match[3];
          } else {
            debugHost = match[3];
          }
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
          debugOption = match[1];
          debugHost = match[3];
          debugPort = match[4];
        }
        if (debugOption && debugPort !== "0") {
          return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
        }
        return arg;
      });
    }
    exports.Command = Command2;
  }
});

// node_modules/.pnpm/commander@12.1.0/node_modules/commander/index.js
var require_commander = __commonJS({
  "node_modules/.pnpm/commander@12.1.0/node_modules/commander/index.js"(exports) {
    var { Argument: Argument2 } = require_argument();
    var { Command: Command2 } = require_command();
    var { CommanderError: CommanderError2, InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var { Help: Help2 } = require_help();
    var { Option: Option2 } = require_option();
    exports.program = new Command2();
    exports.createCommand = (name) => new Command2(name);
    exports.createOption = (flags, description) => new Option2(flags, description);
    exports.createArgument = (name, description) => new Argument2(name, description);
    exports.Command = Command2;
    exports.Option = Option2;
    exports.Argument = Argument2;
    exports.Help = Help2;
    exports.CommanderError = CommanderError2;
    exports.InvalidArgumentError = InvalidArgumentError2;
    exports.InvalidOptionArgumentError = InvalidArgumentError2;
  }
});

// node_modules/.pnpm/commander@12.1.0/node_modules/commander/esm.mjs
var import_index = __toESM(require_commander(), 1);
var {
  program,
  createCommand,
  createArgument,
  createOption,
  CommanderError,
  InvalidArgumentError,
  InvalidOptionArgumentError,
  // deprecated old name
  Command,
  Argument,
  Option,
  Help
} = import_index.default;

// experimental/websim-cli/src/lib/auth.ts
import fs7 from "fs";

// node_modules/.pnpm/open@10.2.0/node_modules/open/index.js
import process7 from "node:process";
import { Buffer as Buffer2 } from "node:buffer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify as promisify5 } from "node:util";
import childProcess from "node:child_process";
import fs5, { constants as fsConstants2 } from "node:fs/promises";

// node_modules/.pnpm/wsl-utils@0.1.0/node_modules/wsl-utils/index.js
import process3 from "node:process";
import fs4, { constants as fsConstants } from "node:fs/promises";

// node_modules/.pnpm/is-wsl@3.1.0/node_modules/is-wsl/index.js
import process2 from "node:process";
import os from "node:os";
import fs3 from "node:fs";

// node_modules/.pnpm/is-inside-container@1.0.0/node_modules/is-inside-container/index.js
import fs2 from "node:fs";

// node_modules/.pnpm/is-docker@3.0.0/node_modules/is-docker/index.js
import fs from "node:fs";
var isDockerCached;
function hasDockerEnv() {
  try {
    fs.statSync("/.dockerenv");
    return true;
  } catch {
    return false;
  }
}
function hasDockerCGroup() {
  try {
    return fs.readFileSync("/proc/self/cgroup", "utf8").includes("docker");
  } catch {
    return false;
  }
}
function isDocker() {
  if (isDockerCached === void 0) {
    isDockerCached = hasDockerEnv() || hasDockerCGroup();
  }
  return isDockerCached;
}

// node_modules/.pnpm/is-inside-container@1.0.0/node_modules/is-inside-container/index.js
var cachedResult;
var hasContainerEnv = () => {
  try {
    fs2.statSync("/run/.containerenv");
    return true;
  } catch {
    return false;
  }
};
function isInsideContainer() {
  if (cachedResult === void 0) {
    cachedResult = hasContainerEnv() || isDocker();
  }
  return cachedResult;
}

// node_modules/.pnpm/is-wsl@3.1.0/node_modules/is-wsl/index.js
var isWsl = () => {
  if (process2.platform !== "linux") {
    return false;
  }
  if (os.release().toLowerCase().includes("microsoft")) {
    if (isInsideContainer()) {
      return false;
    }
    return true;
  }
  try {
    return fs3.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft") ? !isInsideContainer() : false;
  } catch {
    return false;
  }
};
var is_wsl_default = process2.env.__IS_WSL_TEST__ ? isWsl : isWsl();

// node_modules/.pnpm/wsl-utils@0.1.0/node_modules/wsl-utils/index.js
var wslDrivesMountPoint = (() => {
  const defaultMountPoint = "/mnt/";
  let mountPoint;
  return async function() {
    if (mountPoint) {
      return mountPoint;
    }
    const configFilePath = "/etc/wsl.conf";
    let isConfigFileExists = false;
    try {
      await fs4.access(configFilePath, fsConstants.F_OK);
      isConfigFileExists = true;
    } catch {
    }
    if (!isConfigFileExists) {
      return defaultMountPoint;
    }
    const configContent = await fs4.readFile(configFilePath, { encoding: "utf8" });
    const configMountPoint = /(?<!#.*)root\s*=\s*(?<mountPoint>.*)/g.exec(configContent);
    if (!configMountPoint) {
      return defaultMountPoint;
    }
    mountPoint = configMountPoint.groups.mountPoint.trim();
    mountPoint = mountPoint.endsWith("/") ? mountPoint : `${mountPoint}/`;
    return mountPoint;
  };
})();
var powerShellPathFromWsl = async () => {
  const mountPoint = await wslDrivesMountPoint();
  return `${mountPoint}c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`;
};
var powerShellPath = async () => {
  if (is_wsl_default) {
    return powerShellPathFromWsl();
  }
  return `${process3.env.SYSTEMROOT || process3.env.windir || String.raw`C:\Windows`}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
};

// node_modules/.pnpm/define-lazy-prop@3.0.0/node_modules/define-lazy-prop/index.js
function defineLazyProperty(object, propertyName, valueGetter) {
  const define = (value) => Object.defineProperty(object, propertyName, { value, enumerable: true, writable: true });
  Object.defineProperty(object, propertyName, {
    configurable: true,
    enumerable: true,
    get() {
      const result = valueGetter();
      define(result);
      return result;
    },
    set(value) {
      define(value);
    }
  });
  return object;
}

// node_modules/.pnpm/default-browser@5.2.1/node_modules/default-browser/index.js
import { promisify as promisify4 } from "node:util";
import process6 from "node:process";
import { execFile as execFile4 } from "node:child_process";

// node_modules/.pnpm/default-browser-id@5.0.0/node_modules/default-browser-id/index.js
import { promisify } from "node:util";
import process4 from "node:process";
import { execFile } from "node:child_process";
var execFileAsync = promisify(execFile);
async function defaultBrowserId() {
  if (process4.platform !== "darwin") {
    throw new Error("macOS only");
  }
  const { stdout } = await execFileAsync("defaults", ["read", "com.apple.LaunchServices/com.apple.launchservices.secure", "LSHandlers"]);
  const match = /LSHandlerRoleAll = "(?!-)(?<id>[^"]+?)";\s+?LSHandlerURLScheme = (?:http|https);/.exec(stdout);
  return match?.groups.id ?? "com.apple.Safari";
}

// node_modules/.pnpm/run-applescript@7.1.0/node_modules/run-applescript/index.js
import process5 from "node:process";
import { promisify as promisify2 } from "node:util";
import { execFile as execFile2, execFileSync } from "node:child_process";
var execFileAsync2 = promisify2(execFile2);
async function runAppleScript(script, { humanReadableOutput = true, signal } = {}) {
  if (process5.platform !== "darwin") {
    throw new Error("macOS only");
  }
  const outputArguments = humanReadableOutput ? [] : ["-ss"];
  const execOptions = {};
  if (signal) {
    execOptions.signal = signal;
  }
  const { stdout } = await execFileAsync2("osascript", ["-e", script, outputArguments], execOptions);
  return stdout.trim();
}

// node_modules/.pnpm/bundle-name@4.1.0/node_modules/bundle-name/index.js
async function bundleName(bundleId) {
  return runAppleScript(`tell application "Finder" to set app_path to application file id "${bundleId}" as string
tell application "System Events" to get value of property list item "CFBundleName" of property list file (app_path & ":Contents:Info.plist")`);
}

// node_modules/.pnpm/default-browser@5.2.1/node_modules/default-browser/windows.js
import { promisify as promisify3 } from "node:util";
import { execFile as execFile3 } from "node:child_process";
var execFileAsync3 = promisify3(execFile3);
var windowsBrowserProgIds = {
  AppXq0fevzme2pys62n3e0fbqa7peapykr8v: { name: "Edge", id: "com.microsoft.edge.old" },
  MSEdgeDHTML: { name: "Edge", id: "com.microsoft.edge" },
  // On macOS, it's "com.microsoft.edgemac"
  MSEdgeHTM: { name: "Edge", id: "com.microsoft.edge" },
  // Newer Edge/Win10 releases
  "IE.HTTP": { name: "Internet Explorer", id: "com.microsoft.ie" },
  FirefoxURL: { name: "Firefox", id: "org.mozilla.firefox" },
  ChromeHTML: { name: "Chrome", id: "com.google.chrome" },
  BraveHTML: { name: "Brave", id: "com.brave.Browser" },
  BraveBHTML: { name: "Brave Beta", id: "com.brave.Browser.beta" },
  BraveSSHTM: { name: "Brave Nightly", id: "com.brave.Browser.nightly" }
};
var UnknownBrowserError = class extends Error {
};
async function defaultBrowser(_execFileAsync = execFileAsync3) {
  const { stdout } = await _execFileAsync("reg", [
    "QUERY",
    " HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice",
    "/v",
    "ProgId"
  ]);
  const match = /ProgId\s*REG_SZ\s*(?<id>\S+)/.exec(stdout);
  if (!match) {
    throw new UnknownBrowserError(`Cannot find Windows browser in stdout: ${JSON.stringify(stdout)}`);
  }
  const { id } = match.groups;
  const browser = windowsBrowserProgIds[id];
  if (!browser) {
    throw new UnknownBrowserError(`Unknown browser ID: ${id}`);
  }
  return browser;
}

// node_modules/.pnpm/default-browser@5.2.1/node_modules/default-browser/index.js
var execFileAsync4 = promisify4(execFile4);
var titleize = (string) => string.toLowerCase().replaceAll(/(?:^|\s|-)\S/g, (x) => x.toUpperCase());
async function defaultBrowser2() {
  if (process6.platform === "darwin") {
    const id = await defaultBrowserId();
    const name = await bundleName(id);
    return { name, id };
  }
  if (process6.platform === "linux") {
    const { stdout } = await execFileAsync4("xdg-mime", ["query", "default", "x-scheme-handler/http"]);
    const id = stdout.trim();
    const name = titleize(id.replace(/.desktop$/, "").replace("-", " "));
    return { name, id };
  }
  if (process6.platform === "win32") {
    return defaultBrowser();
  }
  throw new Error("Only macOS, Linux, and Windows are supported");
}

// node_modules/.pnpm/open@10.2.0/node_modules/open/index.js
var execFile5 = promisify5(childProcess.execFile);
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var localXdgOpenPath = path.join(__dirname, "xdg-open");
var { platform, arch } = process7;
async function getWindowsDefaultBrowserFromWsl() {
  const powershellPath = await powerShellPath();
  const rawCommand = String.raw`(Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice").ProgId`;
  const encodedCommand = Buffer2.from(rawCommand, "utf16le").toString("base64");
  const { stdout } = await execFile5(
    powershellPath,
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      encodedCommand
    ],
    { encoding: "utf8" }
  );
  const progId = stdout.trim();
  const browserMap = {
    ChromeHTML: "com.google.chrome",
    BraveHTML: "com.brave.Browser",
    MSEdgeHTM: "com.microsoft.edge",
    FirefoxURL: "org.mozilla.firefox"
  };
  return browserMap[progId] ? { id: browserMap[progId] } : {};
}
var pTryEach = async (array, mapper) => {
  let latestError;
  for (const item of array) {
    try {
      return await mapper(item);
    } catch (error) {
      latestError = error;
    }
  }
  throw latestError;
};
var baseOpen = async (options) => {
  options = {
    wait: false,
    background: false,
    newInstance: false,
    allowNonzeroExitCode: false,
    ...options
  };
  if (Array.isArray(options.app)) {
    return pTryEach(options.app, (singleApp) => baseOpen({
      ...options,
      app: singleApp
    }));
  }
  let { name: app, arguments: appArguments = [] } = options.app ?? {};
  appArguments = [...appArguments];
  if (Array.isArray(app)) {
    return pTryEach(app, (appName) => baseOpen({
      ...options,
      app: {
        name: appName,
        arguments: appArguments
      }
    }));
  }
  if (app === "browser" || app === "browserPrivate") {
    const ids = {
      "com.google.chrome": "chrome",
      "google-chrome.desktop": "chrome",
      "com.brave.Browser": "brave",
      "org.mozilla.firefox": "firefox",
      "firefox.desktop": "firefox",
      "com.microsoft.msedge": "edge",
      "com.microsoft.edge": "edge",
      "com.microsoft.edgemac": "edge",
      "microsoft-edge.desktop": "edge"
    };
    const flags = {
      chrome: "--incognito",
      brave: "--incognito",
      firefox: "--private-window",
      edge: "--inPrivate"
    };
    const browser = is_wsl_default ? await getWindowsDefaultBrowserFromWsl() : await defaultBrowser2();
    if (browser.id in ids) {
      const browserName = ids[browser.id];
      if (app === "browserPrivate") {
        appArguments.push(flags[browserName]);
      }
      return baseOpen({
        ...options,
        app: {
          name: apps[browserName],
          arguments: appArguments
        }
      });
    }
    throw new Error(`${browser.name} is not supported as a default browser`);
  }
  let command;
  const cliArguments = [];
  const childProcessOptions = {};
  if (platform === "darwin") {
    command = "open";
    if (options.wait) {
      cliArguments.push("--wait-apps");
    }
    if (options.background) {
      cliArguments.push("--background");
    }
    if (options.newInstance) {
      cliArguments.push("--new");
    }
    if (app) {
      cliArguments.push("-a", app);
    }
  } else if (platform === "win32" || is_wsl_default && !isInsideContainer() && !app) {
    command = await powerShellPath();
    cliArguments.push(
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand"
    );
    if (!is_wsl_default) {
      childProcessOptions.windowsVerbatimArguments = true;
    }
    const encodedArguments = ["Start"];
    if (options.wait) {
      encodedArguments.push("-Wait");
    }
    if (app) {
      encodedArguments.push(`"\`"${app}\`""`);
      if (options.target) {
        appArguments.push(options.target);
      }
    } else if (options.target) {
      encodedArguments.push(`"${options.target}"`);
    }
    if (appArguments.length > 0) {
      appArguments = appArguments.map((argument) => `"\`"${argument}\`""`);
      encodedArguments.push("-ArgumentList", appArguments.join(","));
    }
    options.target = Buffer2.from(encodedArguments.join(" "), "utf16le").toString("base64");
  } else {
    if (app) {
      command = app;
    } else {
      const isBundled = !__dirname || __dirname === "/";
      let exeLocalXdgOpen = false;
      try {
        await fs5.access(localXdgOpenPath, fsConstants2.X_OK);
        exeLocalXdgOpen = true;
      } catch {
      }
      const useSystemXdgOpen = process7.versions.electron ?? (platform === "android" || isBundled || !exeLocalXdgOpen);
      command = useSystemXdgOpen ? "xdg-open" : localXdgOpenPath;
    }
    if (appArguments.length > 0) {
      cliArguments.push(...appArguments);
    }
    if (!options.wait) {
      childProcessOptions.stdio = "ignore";
      childProcessOptions.detached = true;
    }
  }
  if (platform === "darwin" && appArguments.length > 0) {
    cliArguments.push("--args", ...appArguments);
  }
  if (options.target) {
    cliArguments.push(options.target);
  }
  const subprocess = childProcess.spawn(command, cliArguments, childProcessOptions);
  if (options.wait) {
    return new Promise((resolve, reject) => {
      subprocess.once("error", reject);
      subprocess.once("close", (exitCode) => {
        if (!options.allowNonzeroExitCode && exitCode > 0) {
          reject(new Error(`Exited with code ${exitCode}`));
          return;
        }
        resolve(subprocess);
      });
    });
  }
  subprocess.unref();
  return subprocess;
};
var open = (target, options) => {
  if (typeof target !== "string") {
    throw new TypeError("Expected a `target`");
  }
  return baseOpen({
    ...options,
    target
  });
};
function detectArchBinary(binary) {
  if (typeof binary === "string" || Array.isArray(binary)) {
    return binary;
  }
  const { [arch]: archBinary } = binary;
  if (!archBinary) {
    throw new Error(`${arch} is not supported`);
  }
  return archBinary;
}
function detectPlatformBinary({ [platform]: platformBinary }, { wsl }) {
  if (wsl && is_wsl_default) {
    return detectArchBinary(wsl);
  }
  if (!platformBinary) {
    throw new Error(`${platform} is not supported`);
  }
  return detectArchBinary(platformBinary);
}
var apps = {};
defineLazyProperty(apps, "chrome", () => detectPlatformBinary({
  darwin: "google chrome",
  win32: "chrome",
  linux: ["google-chrome", "google-chrome-stable", "chromium"]
}, {
  wsl: {
    ia32: "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    x64: ["/mnt/c/Program Files/Google/Chrome/Application/chrome.exe", "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"]
  }
}));
defineLazyProperty(apps, "brave", () => detectPlatformBinary({
  darwin: "brave browser",
  win32: "brave",
  linux: ["brave-browser", "brave"]
}, {
  wsl: {
    ia32: "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe",
    x64: ["/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe", "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe"]
  }
}));
defineLazyProperty(apps, "firefox", () => detectPlatformBinary({
  darwin: "firefox",
  win32: String.raw`C:\Program Files\Mozilla Firefox\firefox.exe`,
  linux: "firefox"
}, {
  wsl: "/mnt/c/Program Files/Mozilla Firefox/firefox.exe"
}));
defineLazyProperty(apps, "edge", () => detectPlatformBinary({
  darwin: "microsoft edge",
  win32: "msedge",
  linux: ["microsoft-edge", "microsoft-edge-dev"]
}, {
  wsl: "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
}));
defineLazyProperty(apps, "browser", () => "browser");
defineLazyProperty(apps, "browserPrivate", () => "browserPrivate");
var open_default = open;

// experimental/websim-cli/src/lib/auth.ts
import os2 from "os";
import path3 from "path";

// packages/router/src/path.ts
function formatPath(path6, params) {
  const parts = path6.replace(/^\//, "").replace(/\+$/, "").split("/");
  return "/" + parts.map((part) => {
    if (part.startsWith(":")) {
      const key = part.slice(1);
      if (key in params) {
        return params[key];
      } else {
        throw new Error(`Param ${key} is required`);
      }
    }
    return part;
  }).join("/");
}

// packages/router/src/client.ts
function createClient(options = {}) {
  return {
    ref: (ref) => {
      const [method, path6] = ref.split(" ");
      return {
        fetch: async (args = {}) => {
          const headers = new Headers();
          const url = new URL(
            `${options.baseUrl}${formatPath(
              path6,
              "params" in args ? args.params : {}
            )}`
          );
          if ("query" in args && args.query) {
            for (const [key, value] of Object.entries(args.query)) {
              let encodedValue;
              if (value === void 0) {
                continue;
              }
              if (typeof value === "string" && !["true", "false", "null"].includes(value.trim()) && isNaN(Number(value))) {
                encodedValue = value;
              } else {
                encodedValue = JSON.stringify(value);
              }
              url.searchParams.set(key, encodedValue);
            }
          }
          let body;
          if ("body" in args && args.body) {
            const contentType2 = args.contentType ?? "application/json";
            switch (contentType2) {
              case "application/json":
                headers.set("Content-Type", contentType2);
                body = JSON.stringify(args.body);
                break;
              case "application/x-www-form-urlencoded":
                headers.set("Content-Type", contentType2);
                if (args.body instanceof URLSearchParams) {
                  body = args.body;
                } else {
                  body = new URLSearchParams(args.body);
                }
                break;
              case "multipart/form-data":
                if (args.body instanceof FormData) {
                  body = args.body;
                } else {
                  body = new FormData();
                  for (const [key, value] of Object.entries(args.body)) {
                    body.append(key, value);
                  }
                }
                break;
              default:
                throw new Error(
                  `Unsupported content type: ${args.contentType}`
                );
            }
          }
          if (options.headers) {
            for (const [key, value] of Object.entries(options.headers)) {
              headers.set(key, value);
            }
          }
          if ("headers" in args && args.headers) {
            for (const [key, value] of Object.entries(args.headers)) {
              headers.set(key, value);
            }
          }
          if ("extraHeaders" in args && args.extraHeaders) {
            for (const [key, value] of Object.entries(args.extraHeaders)) {
              headers.set(key, value);
            }
          }
          const response = await (options.fetch ?? fetch)(url, {
            method,
            headers,
            body,
            signal: args.signal,
            mode: args.mode,
            credentials: args.credentials,
            redirect: args.redirect,
            referrer: args.referrer,
            referrerPolicy: args.referrerPolicy,
            integrity: args.integrity,
            cache: args.cache,
            window: args.window
          });
          const contentType = response.headers.get("content-type");
          if (contentType?.includes("application/") && contentType?.includes("json")) {
            return {
              ok: response.ok,
              status: response.status,
              body: await response.json(),
              headers: response.headers
            };
          }
          if (contentType?.includes("text/")) {
            return {
              ok: response.ok,
              status: response.status,
              body: await response.text(),
              headers: response.headers
            };
          }
          return {
            ok: response.ok,
            status: response.status,
            body: await response.blob(),
            headers: response.headers
          };
        }
      };
    }
  };
}

// experimental/websim-cli/src/api-client.ts
import crypto from "crypto";
import fs6 from "fs";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// experimental/websim-cli/src/agent-md.ts
function renderAgentMd(ctx) {
  return `# ${ctx.title ?? "Websim project"}

${ctx.description ? ctx.description + "\n\n" : ""}This directory is the complete source of a websim project (id \`${ctx.projectId}\`, checked out from version ${ctx.baseVersion}).
Live site: https://websim.com/p/${ctx.projectId}

## Runtime contract \u2014 read before editing

This site is served by websim.com and runs inside a sandboxed iframe. At serve
time the platform injects a runtime script that defines global APIs. This is
why the code references globals that are never imported:

- \`window.websim\` (also reachable as \`websim\`) \u2014 platform APIs, documented below
- \`WebsimSocket\` \u2014 global class for multiplayer/database features

These globals are real and work in production. **Do not import, polyfill,
stub, or remove them.** Code that uses them is not broken.

Rules:
1. **No build tooling.** Never add package.json, node_modules, bundler or
   framework configs. The platform serves these files exactly as uploaded
   (\`.jsx\`/\`.tsx\` files are transpiled server-side automatically).
2. **Keep API calls relative.** \`fetch('/api/v1/...')\` is routed and
   authenticated by the platform. Never rewrite to absolute
   \`https://api.websim.com/...\` URLs.
3. **Libraries** come from CDN ESM imports (https://esm.sh) or a
   \`<script type="importmap">\` in index.html \u2014 not from npm installs.
4. File paths are **case-insensitive**; never create paths differing only by
   case. Keep asset references relative.
5. Preserve any \`/* @tweakable */\` comments exactly \u2014 they are a platform
   feature, not noise.
6. Do not modify \`.websim.json\`, \`.websim-manifest.json\`, or this file.
7. The platform injects analytics and social meta tags at serve time \u2014 do not
   add tracking or fight the injection.

## Local testing

\`\`\`
websim dev          # from this directory \u2192 http://localhost:8787
\`\`\`

This serves the files with a standalone SDK: \`websim.chat\`, \`websim.imageGen\`,
\`websim.textToSpeech\`, comments, and user/project info are REAL (authenticated
as the project owner); \`WebsimSocket\` multiplayer/database is a harmless local
stub. Known fidelity gaps vs production: visitors there may be anonymous (you
are always logged in locally), the production site runs in an iframe, and
\`.jsx\`/\`.tsx\` transpilation does not happen locally (plain \`.js\`/\`.html\`/\`.css\`
is unaffected).

## Platform API quick reference

\`\`\`js
// AI \u2014 chat completion (returns { role: "assistant", content: string })
const msg = await websim.chat.completions.create({
  messages: [{ role: "user", content: "..." }], // role: "user" | "assistant" | "system"
  json: true, // optional: ask for a JSON-only answer (then JSON.parse(msg.content))
});

// AI \u2014 image generation (returns { url })
const img = await websim.imageGen({ prompt: "...", aspect_ratio: "1:1" /* optional: width, height, seed, transparent */ });

// AI \u2014 text to speech (returns { url } of audio)
const speech = await websim.textToSpeech({ text: "...", voice: "en-male" /* e.g. en-male, en-female, it-male */ });

// Identity & context
const user = await websim.getCurrentUser();      // { id, username, avatar_url }
const project = await websim.getCurrentProject(); // { id, title, description }

// Comments (the project's social feed; also usable as simple storage)
await websim.postComment({ content: "markdown **content**" }); // rate limit: 5/min
websim.addEventListener("comment:created", (data) => { /* live updates */ });
const res = await fetch(\`/api/v1/projects/\${project.id}/comments?first=50&sort_by=best\`);
const { comments } = await res.json(); // { data: [{ comment, ... }], meta }
\`\`\`

## Publishing

\`\`\`
websim sync --no-open               # new version, immediately live
websim sync --no-open --no-promote  # new candidate version, live site unchanged
\`\`\`
`;
}

// experimental/websim-cli/src/api-client.ts
var USER_AGENT = "websim-cli/1.0";
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function calculateFileHash(filePath) {
  const buffer = await fs6.promises.readFile(filePath);
  const hash = crypto.createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}
function getAssetUrl(contentOrigin, {
  path: path6,
  project_id,
  project_version
}) {
  try {
    let baseUrl = contentOrigin.replace("{PROJECT_ID}", project_id);
    if (!baseUrl.endsWith("/")) {
      baseUrl += "/";
    }
    const url = new URL(path6, baseUrl);
    url.searchParams.set("v", project_version.toString());
    url.searchParams.set("raw", "true");
    return url.toString();
  } catch (error) {
    console.error(
      `Failed to construct asset URL for path: ${path6}, contentOrigin: ${contentOrigin}, project_id: ${project_id}`
    );
    throw new Error(
      `Invalid URL construction: ${error instanceof Error ? error.message : error}`
    );
  }
}
var WebsimApiClient = class {
  client;
  baseUrl;
  authToken;
  constructor({ baseUrl, authToken }) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
    this.client = createClient({
      baseUrl: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        "User-Agent": USER_AGENT
      }
    });
  }
  setAuthToken(token) {
    this.authToken = token;
    this.client = createClient({
      baseUrl: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        "User-Agent": USER_AGENT
      }
    });
  }
  // Site Management Methods
  // ----------------------
  async createSite(body) {
    const response = await this.client.ref("POST /sites").fetch({
      body
    });
    if (!response.ok) {
      console.error("Failed to create site", response.body);
      throw response.body;
    }
    return response.body;
  }
  async getSite(siteId) {
    const response = await this.client.ref("GET /sites/:id").fetch({
      params: { id: siteId }
    });
    if (!response.ok) {
      console.error("Failed to get site", response.body);
      throw response.body;
    }
    return response.body;
  }
  async getSiteLineage(siteId) {
    const lineage = [];
    let currentSiteId = siteId;
    const visitedSites = /* @__PURE__ */ new Set();
    while (currentSiteId) {
      if (visitedSites.has(currentSiteId)) {
        console.warn(`Cycle detected at site ${currentSiteId}, stopping traversal`);
        break;
      }
      visitedSites.add(currentSiteId);
      try {
        const siteData = await this.getSite(currentSiteId);
        lineage.push({
          site: siteData.site,
          project: siteData.project,
          project_revision: siteData.project_revision
        });
        currentSiteId = siteData.site.parent_id;
      } catch (error) {
        console.error(`Failed to get site ${currentSiteId}:`, error);
        break;
      }
    }
    return lineage;
  }
  async getUserSites(user, params = {}) {
    const response = await this.client.ref("GET /users/:user/sites").fetch({
      params: { user },
      query: params
    });
    if (!response.ok) {
      console.error("Failed to get user sites", response.body);
      throw response.body;
    }
    return response.body.sites;
  }
  async getCurrentUserSites(params = {}) {
    const response = await this.client.ref("GET /user/sites").fetch({
      query: params
    });
    if (!response.ok) {
      console.error("Failed to get current user sites", response.body);
      throw response.body;
    }
    return response.body.sites;
  }
  // Project Management Methods
  // ------------------------
  async createProject(body) {
    const response = await this.client.ref("POST /projects").fetch({
      body,
      query: { include: ["permissions"] }
    });
    if (!response.ok) {
      console.error("Failed to create project", response.body);
      throw response.body;
    }
    return response.body;
  }
  async getUserProjects(user, params = {}) {
    const response = await this.client.ref("GET /users/:user/projects").fetch({
      params: { user },
      query: params
    });
    if (!response.ok) {
      console.error("Failed to get user projects", response.body);
      throw response.body;
    }
    return response.body.projects;
  }
  async getCurrentUserProjects(params = {}) {
    const response = await this.client.ref("GET /user/projects").fetch({
      query: params
    });
    if (!response.ok) {
      console.error("Failed to get current user projects", response.body);
      throw response.body;
    }
    return response.body.projects;
  }
  async getProject(projectId, query) {
    const response = await this.client.ref("GET /projects/:id").fetch({
      params: { id: projectId },
      query: query || {}
    });
    if (!response.ok) {
      console.error("Failed to get project", response.body);
      throw response.body;
    }
    return response.body;
  }
  async getProjectLineage(projectId) {
    const lineage = [];
    let currentProjectId = projectId;
    const visitedProjects = /* @__PURE__ */ new Set();
    while (currentProjectId) {
      if (visitedProjects.has(currentProjectId)) {
        console.warn(`Cycle detected at project ${currentProjectId}, stopping traversal`);
        break;
      }
      visitedProjects.add(currentProjectId);
      try {
        const projectData = await this.getProject(currentProjectId);
        lineage.push({
          project: projectData.project,
          project_revision: projectData.project_revision
        });
        currentProjectId = projectData.project.parent_id;
      } catch (error) {
        console.error(`Failed to get project ${currentProjectId}:`, error);
        break;
      }
    }
    return lineage;
  }
  async getProjectName(projectId) {
    const projectResponse = await this.getProject(projectId);
    if (!projectResponse.project) {
      throw new Error("Project not found");
    }
    return projectResponse.project.title || `project-${projectId}`;
  }
  async getProjectRevisions(args) {
    const response = await this.client.ref("GET /projects/:id/revisions").fetch({
      params: { id: args.projectId },
      query: {
        first: args.first,
        last: args.last,
        before: args.before,
        after: args.after
      }
    });
    if (!response.ok) {
      console.error("Failed to get project revisions", response.body);
      throw response.body;
    }
    return response.body.revisions;
  }
  async getLatestRevisionVersion(projectId) {
    const revisions = await this.getProjectRevisions({ projectId, first: 1 });
    const latest = revisions.data[0]?.project_revision.version;
    if (!latest) {
      throw new Error("No project revision found");
    }
    return latest;
  }
  // Revision Management Methods
  // -------------------------
  async createProjectRevision(projectId, parentVersion) {
    if (!parentVersion) {
      parentVersion = await this.getLatestRevisionVersion(projectId);
    }
    const response = await this.client.ref("POST /projects/:id/revisions").fetch({
      params: { id: projectId },
      body: { parent_version: parentVersion }
    });
    if (!response.ok) {
      throw response.body;
    }
    return response.body;
  }
  async getRevisionAssets(projectId, revisionVersion) {
    const response = await this.client.ref("GET /projects/:id/revisions/:version/assets").fetch({
      params: {
        id: projectId,
        version: revisionVersion
      }
    });
    if (!response.ok) {
      throw response.body;
    }
    return response.body;
  }
  /** Retry a flaky request a few times with exponential backoff. */
  async withRetry(fn, attempts = 4) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < attempts - 1) {
          await sleep(500 * Math.pow(2, i));
        }
      }
    }
    throw lastError;
  }
  /**
   * Delete a single asset (by path) from a still-draft revision via the
   * edit-assets endpoint. The path is sent in the body, so paths containing
   * slashes or spaces (e.g. "all menu/2022.png") work without URL-encoding.
   */
  async deleteRevisionAsset(projectId, revisionVersion, assetPath) {
    const response = await this.client.ref("POST /projects/:id/revisions/:version/edit-assets").fetch({
      params: { id: projectId, version: revisionVersion },
      body: { operation: { type: "delete", path: assetPath } }
    });
    if (!response.ok) {
      throw response.body;
    }
    return response.body;
  }
  // Experiment Methods
  // ------------------
  async startExperiment(projectId, arms) {
    const response = await this.client.ref("POST /projects/:id/experiment").fetch({
      params: { id: projectId },
      body: { arms }
    });
    if (!response.ok) {
      throw response.body;
    }
    return response.body;
  }
  async stopExperiment(projectId) {
    const response = await this.client.ref("DELETE /projects/:id/experiment").fetch({
      params: { id: projectId }
    });
    if (!response.ok) {
      throw response.body;
    }
  }
  async getExperiment(projectId) {
    const response = await this.client.ref("GET /projects/:id/experiment").fetch({
      params: { id: projectId }
    });
    if (!response.ok) {
      throw response.body;
    }
    return response.body;
  }
  async getExperimentStats(projectId) {
    const response = await this.client.ref("GET /projects/:id/experiment/stats").fetch({
      params: { id: projectId }
    });
    if (!response.ok) {
      throw response.body;
    }
    return response.body;
  }
  async setProjectCurrentVersion(projectId, version) {
    const response = await this.client.ref("PATCH /projects/:id").fetch({
      params: { id: projectId },
      body: { current_version: version }
    });
    if (!response.ok) {
      console.error("Failed to set current version", response.body);
      throw response.body;
    }
    return response.body;
  }
  async finalizeRevision(projectId, revisionVersion) {
    const response = await fetch(
      `${this.baseUrl}/projects/${projectId}/revisions/${revisionVersion}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT
        },
        body: JSON.stringify({ draft: false })
      }
    );
    if (!response.ok) {
      throw await response.json();
    }
    return await response.json();
  }
  // Asset Management Methods
  // ----------------------
  async uploadAssets(projectId, revisionVersion, filesInfos) {
    const existingAssetIdsPromise = this.getExistingAssetIds(
      projectId,
      revisionVersion,
      filesInfos
    );
    const files = await Promise.all(
      filesInfos.map(async (file) => {
        const buffer = await fs6.promises.readFile(
          file.filePath
        );
        return new File([buffer], file.targetPath);
      })
    );
    const existingAssetIds = await existingAssetIdsPromise;
    const BATCH_SIZE = 10;
    const results = [];
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batchFiles = files.slice(i, i + BATCH_SIZE);
      const batchExistingIds = existingAssetIds.slice(i, i + BATCH_SIZE);
      console.log(
        `Uploading batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          files.length / BATCH_SIZE
        )} (${batchFiles.length} files)...`
      );
      const formData = new FormData();
      const contents = batchFiles.map((file, index) => ({
        size: file.size,
        existingAssetId: batchExistingIds?.[index]
      }));
      formData.append("contents", JSON.stringify(contents));
      batchFiles.forEach((file, index) => {
        formData.append(String(index), file);
      });
      const response = await fetch(
        `${this.baseUrl}/projects/${projectId}/revisions/${revisionVersion}/assets`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            "User-Agent": USER_AGENT
          }
        }
      );
      if (!response.ok) {
        console.error(
          `Failed to upload batch ${Math.floor(i / BATCH_SIZE) + 1}`,
          await response.text()
        );
        throw await response.text();
      }
      const batchResult = await response.json();
      results.push(batchResult["assets"]);
    }
    return results.flat();
  }
  async getExistingAssetIds(projectId, revisionVersion, filesInfos) {
    try {
      const assetsResponse = await this.getRevisionAssets(
        projectId,
        revisionVersion
      );
      const currentAssets = assetsResponse.assets || [];
      const assetsByPath = {};
      currentAssets.forEach((asset) => {
        assetsByPath[asset.path] = asset.id;
      });
      return filesInfos.map((file) => assetsByPath[file.targetPath]);
    } catch (error) {
      console.warn("Failed to fetch existing assets:", error);
      return [];
    }
  }
  // Screenshot Management Methods
  // ---------------------------
  // async triggerScreenshot(projectId: string, revisionVersion: number) {
  //   const response = await fetch(
  //     `${this.baseUrl}/projects/${projectId}/revisions/${revisionVersion}/screenshots`,
  //     {
  //       method: "POST",
  //       headers: {
  //         Authorization: `Bearer ${this.authToken}`,
  //         "Content-Type": "application/json",
  //       },
  //     }
  //   );
  //   if (!response.ok) {
  //     throw await response.json();
  //   }
  //   return await response.json();
  // }
  // Directory Sync Methods
  // --------------------
  async getFilesRecursively(dir) {
    const entries = await fs6.promises.readdir(dir, { withFileTypes: true });
    const subPromises = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path2.join(dir, entry.name);
        const targetPath = path2.relative(process.cwd(), fullPath).replace(/\\/g, "/");
        if (entry.name === ".websim.json" || entry.name === ".cursor" || entry.name === ".git" || entry.name === ".websim-manifest.json" || entry.name === "AGENT.md") {
          return [];
        }
        if (entry.isDirectory()) {
          return this.getFilesRecursively(fullPath);
        } else {
          const contentHash = await calculateFileHash(fullPath);
          return [{ filePath: fullPath, targetPath, contentHash }];
        }
      })
    );
    return subPromises.flat();
  }
  async syncDirectoryToRevision(projectId, revisionVersion, directoryPath) {
    const files = await this.getFilesRecursively(directoryPath);
    const manifest = this.loadFileManifest(directoryPath);
    let filesToUpload = files;
    if (manifest) {
      console.log(`Found manifest with ${manifest.files.length} files`);
      const hashMap = /* @__PURE__ */ new Map();
      manifest.files.forEach((file) => {
        hashMap.set(file.path, file.hash);
      });
      filesToUpload = files.filter((file) => {
        const previousHash = hashMap.get(file.targetPath);
        return !previousHash || previousHash !== file.contentHash;
      });
      console.log(
        `Detected ${filesToUpload.length} new or modified files out of ${files.length} total files`
      );
    } else {
      console.log(
        `No valid manifest found, uploading all ${files.length} files`
      );
    }
    const uploadResult = await this.uploadAssets(
      projectId,
      revisionVersion,
      filesToUpload
    );
    if (files.length > 0) {
      const localPaths = new Set(files.map((file) => file.targetPath));
      const revisionAssets = await this.getRevisionAssets(
        projectId,
        revisionVersion
      );
      const orphanedPaths = (revisionAssets.assets || []).map((asset) => asset.path).filter((assetPath) => !localPaths.has(assetPath));
      if (orphanedPaths.length > 0) {
        console.log(
          `Pruning ${orphanedPaths.length} file(s) absent locally...`
        );
        for (const assetPath of orphanedPaths) {
          await this.withRetry(
            () => this.deleteRevisionAsset(projectId, revisionVersion, assetPath)
          );
          await sleep(150);
        }
      }
    }
    console.log("Finalizing revision...");
    await this.finalizeRevision(projectId, revisionVersion);
    this.saveFileManifest(directoryPath, files);
    return uploadResult;
  }
  // Project Configuration Methods
  // ---------------------------
  getWebsimConfigPath(directoryPath) {
    return path2.join(directoryPath, ".websim.json");
  }
  getCursorRulesPath(directoryPath) {
    return path2.join(directoryPath, ".cursor", "rules");
  }
  getManifestPath(directoryPath) {
    return path2.join(directoryPath, ".websim-manifest.json");
  }
  writeWebsimConfig(directoryPath, projectId, baseVersion) {
    const configPath = this.getWebsimConfigPath(directoryPath);
    const existing = this.readWebsimConfigData(directoryPath);
    const config = {
      projectId,
      baseVersion: baseVersion ?? existing?.baseVersion
    };
    fs6.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  }
  saveFileManifest(directoryPath, filesInfo) {
    const manifestPath = this.getManifestPath(directoryPath);
    const manifest = {
      files: filesInfo.map((file) => ({
        path: file.targetPath,
        hash: file.contentHash || ""
      }))
    };
    fs6.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log(`File manifest saved with ${manifest.files.length} files`);
  }
  loadFileManifest(directoryPath) {
    const manifestPath = this.getManifestPath(directoryPath);
    try {
      if (fs6.existsSync(manifestPath)) {
        const manifestData = fs6.readFileSync(manifestPath, "utf8");
        return JSON.parse(manifestData);
      }
    } catch (error) {
      console.warn("Failed to read file manifest:", error);
    }
    return null;
  }
  writeCursorRules(directoryPath) {
    const sourceRulesDir = fileURLToPath2(new URL("./rules", import.meta.url));
    if (!fs6.existsSync(sourceRulesDir)) {
      return;
    }
    const rulesDir = this.getCursorRulesPath(directoryPath);
    fs6.mkdirSync(rulesDir, { recursive: true });
    try {
      const ruleFiles = fs6.readdirSync(sourceRulesDir).filter((file) => file.endsWith(".mdc"));
      for (const ruleFile of ruleFiles) {
        const sourceRulePath = path2.join(sourceRulesDir, ruleFile);
        const targetRulePath = path2.join(rulesDir, ruleFile);
        const ruleContent = fs6.readFileSync(sourceRulePath, "utf8");
        fs6.writeFileSync(targetRulePath, ruleContent, "utf8");
      }
    } catch (error) {
      console.warn("Failed to write Cursor rules:", error);
    }
  }
  readWebsimConfig(directoryPath) {
    return this.readWebsimConfigData(directoryPath)?.projectId ?? null;
  }
  readWebsimConfigData(directoryPath) {
    const configPath = this.getWebsimConfigPath(directoryPath);
    try {
      if (fs6.existsSync(configPath)) {
        const config = JSON.parse(fs6.readFileSync(configPath, "utf8"));
        if (typeof config.projectId === "string") {
          return {
            projectId: config.projectId,
            baseVersion: typeof config.baseVersion === "number" ? config.baseVersion : void 0
          };
        }
      }
    } catch (error) {
      console.warn("Failed to read .websim.json:", error);
    }
    return null;
  }
  // Directory Pull Methods
  // --------------------
  async pullRevisionToDirectory(projectId, revisionVersion, directoryPath, isClone = false) {
    if (!fs6.existsSync(directoryPath)) {
      fs6.mkdirSync(directoryPath, { recursive: true });
    }
    if (isClone) {
      this.writeCursorRules(directoryPath);
    }
    this.writeWebsimConfig(directoryPath, projectId, revisionVersion);
    const assetsResponse = await this.getRevisionAssets(
      projectId,
      revisionVersion
    );
    const assets = assetsResponse.assets || [];
    const projectResponse = await this.getProject(projectId);
    const siteId = projectResponse.project_revision?.site_id;
    if (!siteId) {
      throw new Error("No site ID found for project");
    }
    const agentMdPath = path2.join(directoryPath, "AGENT.md");
    if (isClone || !fs6.existsSync(agentMdPath)) {
      fs6.writeFileSync(
        agentMdPath,
        renderAgentMd({
          projectId,
          title: projectResponse.project.title,
          description: projectResponse.project.description,
          baseVersion: revisionVersion
        }),
        "utf8"
      );
    }
    let successCount = 0;
    let errorCount = 0;
    const downloadedFiles = [];
    const MAX_CONCURRENT_DOWNLOADS = 30;
    const assetBatches = [];
    for (let i = 0; i < assets.length; i += MAX_CONCURRENT_DOWNLOADS) {
      assetBatches.push(assets.slice(i, i + MAX_CONCURRENT_DOWNLOADS));
    }
    for (const batch of assetBatches) {
      const downloadPromises = batch.map(async (asset) => {
        const localFilePath = path2.join(directoryPath, asset.path);
        try {
          await this.downloadAssetToFile(
            asset.path,
            getAssetUrl("https://{PROJECT_ID}.c.websim.com", asset),
            localFilePath
          );
          const contentHash = await calculateFileHash(localFilePath);
          downloadedFiles.push({
            filePath: localFilePath,
            targetPath: asset.path,
            contentHash
          });
          return { success: true };
        } catch (error) {
          console.error(`Error downloading ${asset.path}: ${error}`);
          return { success: false };
        }
      });
      const results = await Promise.all(downloadPromises);
      successCount += results.filter((r) => r.success).length;
      errorCount += results.filter((r) => !r.success).length;
    }
    this.saveFileManifest(directoryPath, downloadedFiles);
    return {
      success: errorCount === 0,
      message: `Downloaded ${successCount} assets to ${directoryPath}${errorCount > 0 ? `, ${errorCount} assets failed` : ""}`
    };
  }
  async downloadAssetToFile(assetPath, assetUrl, localFilePath) {
    const dirPath = path2.dirname(localFilePath);
    if (!fs6.existsSync(dirPath)) {
      fs6.mkdirSync(dirPath, { recursive: true });
    }
    const response = await fetch(assetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        "User-Agent": USER_AGENT
      }
    });
    if (!response.ok) {
      console.error(
        `Failed to download ${assetPath}: ${response.status} ${response.statusText}`
      );
      throw new Error(
        `Failed to download ${assetPath}: ${response.status} ${response.statusText}`
      );
    }
    const contentType = response.headers.get("content-type");
    const isText = this.isTextContent(contentType);
    await this.writeAssetToFile(response, localFilePath, isText);
    console.log(`Downloaded: ${assetPath}`);
  }
  async fetchIndexHtmlContent(siteId) {
    if (!siteId) {
      return null;
    }
    try {
      console.log(`Fetching HTML content from site ${siteId}...`);
      const response = await fetch(`${this.baseUrl}/sites/${siteId}/html`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT
        }
      });
      if (!response.ok) {
        console.warn(
          `Failed to fetch HTML content: ${response.status} ${response.statusText}`
        );
        return null;
      }
      const htmlContent = await response.text();
      return this.processHtmlContent(htmlContent);
    } catch (error) {
      console.warn("Error fetching HTML content:", error);
      return null;
    }
  }
  async writeIndexHtml(directoryPath, content) {
    try {
      const indexHtmlPath = path2.join(directoryPath, "index.html");
      const dirPath = path2.dirname(indexHtmlPath);
      if (!fs6.existsSync(dirPath)) {
        fs6.mkdirSync(dirPath, { recursive: true });
      }
      fs6.writeFileSync(indexHtmlPath, content, "utf8");
      console.log("Written index.html to disk");
    } catch (error) {
      console.error(`Error writing index.html: ${error}`);
    }
  }
  // Utility Methods
  // -------------
  processHtmlContent(html) {
    return html.split("\n").filter((line) => !line.includes("<base href=")).join("\n");
  }
  isIndexHtml(path6) {
    return path6 === "index.html" || path6.endsWith("/index.html");
  }
  isTextContent(contentType) {
    if (!contentType)
      return false;
    const isText = contentType?.startsWith("text/") || [
      "application/json",
      "application/javascript",
      "application/xml"
    ].includes(contentType ?? "");
    return isText;
  }
  async writeAssetToFile(response, filePath, isText) {
    if (isText) {
      const content = await response.text();
      fs6.writeFileSync(filePath, content, "utf8");
    } else {
      const content = await response.arrayBuffer();
      fs6.writeFileSync(filePath, new Uint8Array(content));
    }
  }
  async initiateCliLogin() {
    console.log("Initiating CLI login challenge...");
    const response = await this.client.ref("POST /auth/cli/initiate").fetch({
      body: void 0,
      params: {}
    });
    if (!response.ok) {
      console.error("Failed to initiate CLI login challenge", response.body);
      throw response.body;
    }
    return response.body;
  }
  async pollCliLogin(challengeId) {
    console.log("Waiting for browser login completion...");
    const MAX_POLL_ATTEMPTS = 60;
    const POLL_INTERVAL_MS = 5e3;
    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      try {
        const response = await this.client.ref("GET /auth/cli/poll").fetch({
          query: { challengeId }
        });
        if (response.ok && response.body.status === "completed") {
          console.log("Token received.");
          return response.body.authToken;
        }
        if (response.status === 202 && response.body.status === "pending") {
          process.stdout.write(".");
        } else if (response.status === 410 || response.status === 404 && response.body.status === "expired") {
          console.error("\nLogin challenge expired or not found.");
          throw new Error("Login challenge expired or not found.");
        } else {
          console.error(
            `
Unexpected poll status: ${response.status}`,
            response.body
          );
          throw new Error(`Unexpected poll status: ${response.status}`);
        }
      } catch (error) {
        if (error.status === 410 || error.status === 404) {
          console.error("\nLogin challenge expired or not found.");
          throw new Error("Login challenge expired or not found.");
        }
        console.error("\nError polling for login status:", error);
        process.stdout.write("x");
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    console.error("\nLogin polling timed out.");
    throw new Error("Login timed out. Please try again.");
  }
};

// experimental/websim-cli/src/constants.ts
var CLI_CONFIG = {
  name: "websim-cli",
  version: "0.1.0",
  auth: {
    baseUrl: "https://api.websim.com"
    // baseUrl: "http://websim.localhost:8080",
  },
  webBaseUrl: "https://websim.com"
};
var TEST_PROJECT_ID = "k33p7t4u4nwfp4yux80i";

// experimental/websim-cli/src/utils.ts
function handleError(error) {
  if (typeof error === "object" && error !== null && "error" in error && typeof error.error === "object" && error.error !== null && "message" in error.error && typeof error.error.message === "string") {
    console.error("Error:", error.error.message);
    process.exit(1);
  }
  console.error("Error:", error instanceof Error ? error.message : error);
  process.exit(1);
}
function isApiError(error, message) {
  return typeof error === "object" && error !== null && "error" in error && typeof error.error === "object" && error.error !== null && "message" in error.error && error.error.message === message;
}

// experimental/websim-cli/src/lib/auth.ts
var CONFIG_FILE = path3.join(os2.homedir(), ".websim-cli.json");
async function getAuthToken() {
  try {
    if (fs7.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(
        fs7.readFileSync(CONFIG_FILE, "utf8")
      );
      return config.authToken;
    }
  } catch (error) {
    console.error("Error reading auth token:", error);
  }
  await handleLogin();
  return getAuthToken();
}
function saveAuthToken(token) {
  const config = { authToken: token };
  try {
    fs7.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    fs7.chmodSync(CONFIG_FILE, 384);
  } catch (error) {
    console.error("Error saving auth token:", error);
    throw error;
  }
}
async function handleAuthError() {
  console.log("\nAuth token appears to be invalid or expired.");
  return getAuthToken();
}
async function handleLogin() {
  try {
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken: ""
      // Provide a dummy token initially, it won't be used for login initiation
    });
    const loginResponse = await client.initiateCliLogin();
    const { challengeId } = loginResponse;
    const loginUrl = loginResponse.loginUrl.replace(
      "api.websim.com",
      "websim.com"
    );
    console.log(`
Please open this URL in your browser to log in:

${loginUrl}
`);
    try {
      await open_default(loginUrl);
    } catch (err2) {
      console.warn(
        `Failed to automatically open browser: ${err2 instanceof Error ? err2.message : err2}`
      );
      console.log(`Please copy and paste the URL manually.`);
    }
    const authToken = await client.pollCliLogin(challengeId);
    console.log("\nLogin process completed.");
    saveAuthToken(authToken);
    console.log(`Token saved to ${CONFIG_FILE}`);
    console.log("Validating new token...");
    client.setAuthToken(authToken);
    try {
      await client.getProject(TEST_PROJECT_ID);
      console.log("\u2705 Token validated successfully!");
      console.log("You are now logged in.");
    } catch (validationError) {
      console.error("\n\u274C Failed to validate the new token:", validationError);
      console.error(
        "The token was saved, but might be invalid or there was a network issue."
      );
      console.error(
        "Please try running a command like 'websim pull <project-id>' to test."
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`
\u274C Login failed: ${error.message}`);
    } else {
      handleError(error);
    }
    process.exit(1);
  }
}

// experimental/websim-cli/src/commands/auth.ts
function setupAuthCommands(program2) {
  setupLoginCommand(program2);
}
function setupLoginCommand(program2) {
  program2.command("login").description("Log in to Websim by providing an auth token").action(() => {
    handleLogin();
  });
}

// experimental/websim-cli/src/commands/dev.ts
import fs8 from "fs";
import http from "http";
import path4 from "path";
var MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".jsx": "text/jsx",
  ".tsx": "text/tsx"
};
var SDK_SOURCE = `(() => {
  if (window.websim) return;

  const bootstrapPromise = fetch("/__websim/bootstrap").then((r) => {
    if (!r.ok) throw new Error("websim local bootstrap failed: " + r.status);
    return r.json();
  });

  async function post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let message = "HTTP " + res.status;
      try {
        const err = await res.json();
        message = err.error || JSON.stringify(err);
      } catch (_) {}
      throw new Error(url + " failed: " + message);
    }
    return res.json();
  }

  const getUser = async () => (await bootstrapPromise).user;
  const getProject = async () => (await bootstrapPromise).project;
  const projectId = async () => (await getProject()).id;

  window.websim = Object.freeze({
    getUser,
    getCurrentUser: getUser,
    getCreator: getUser, // local dev: you are the project owner
    getCreatedBy: getUser,
    getCurrentProject: getProject,
    getBootstrap: async () => ({ distinct_id: "local-dev", session_id: "local-dev" }),
    getDistinctId: async () => "local-dev",
    getColorScheme: async () =>
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
    chat: {
      completions: {
        create: async ({ messages, json }) => {
          const data = await post("/api/v1/inference/run_chat_completion", {
            project_id: await projectId(),
            messages: (messages || []).slice(-50),
            json,
          });
          return { role: "assistant", content: data.content };
        },
      },
    },
    imageGen: async (args) =>
      post("/api/v1/inference/run_image_generation", {
        project_id: await projectId(),
        ...(args || {}),
      }),
    textToSpeech: async (args) =>
      post("/api/v1/inference/run_text_to_speech", {
        project_id: await projectId(),
        ...(args || {}),
      }),
    postComment: async (args) => {
      try {
        await post("/api/v1/projects/" + (await projectId()) + "/comments", args || {});
        return {};
      } catch (error) {
        return { error: String((error && error.message) || error) };
      }
    },
    addEventListener: (eventType, callback) => {
      bootstrapPromise.then((b) => {
        const es = new EventSource("/api/v1/projects/" + b.project.id + "/events");
        const handle = (raw) => {
          try {
            const msg = JSON.parse(raw);
            if (msg && msg.type === eventType) callback(msg.data);
            else if (msg && !msg.type) callback(msg);
          } catch (_) {}
        };
        es.onmessage = (ev) => handle(ev.data);
        es.addEventListener(eventType, (ev) => handle(ev.data));
      });
      return () => {};
    },
    upload: async () => {
      throw new Error("websim.upload is not supported in local dev yet");
    },
    renderVideo: async () => {
      throw new Error("websim.renderVideo is not supported in local dev");
    },
    experimental: Object.freeze({ v0: Object.freeze({}) }),
    internal_only_experimental: {},
  });

  class LocalWebsimSocket {
    constructor() {
      console.warn(
        "[websim-local] WebsimSocket is a local stub \u2014 multiplayer/database calls are no-ops"
      );
      this.party = {
        presence: {},
        peers: {},
        client: { id: "local", username: "local", avatarUrl: "" },
        roomState: {},
        updatePresence: () => {},
        subscribePresence: () => () => {},
        subscribe: () => () => {},
      };
      this.onmessage = null;
      this.onPeersChanged = null;
    }
    initialize() { return Promise.resolve(); }
    updatePresence() {}
    subscribePresence() { return () => {}; }
    updateRoomState() {}
    subscribeRoomState() { return () => {}; }
    requestPresenceUpdate() {}
    subscribePresenceUpdateRequests() { return () => {}; }
    send() {}
    collection() {
      const api = {
        create: async (d) => d,
        upsert: async (d) => d,
        update: async (_id, d) => d,
        delete: async () => {},
        getList: () => [],
        subscribe: () => () => {},
        filter: () => api,
      };
      return api;
    }
    query() { return { getList: () => [], subscribe: () => () => {} }; }
  }
  if (!window.WebsimSocket) window.WebsimSocket = LocalWebsimSocket;

  console.log(
    "[websim-local] standalone SDK active \u2014 AI/comments/identity are real, multiplayer/db stubbed"
  );
})();
`;
var SDK_TAG = `<script src="/__websim_local_sdk.js"></script>`;
function injectSdkTag(html) {
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch) {
    const insertAt = headMatch.index + headMatch[0].length;
    return html.slice(0, insertAt) + "\n" + SDK_TAG + html.slice(insertAt);
  }
  return SDK_TAG + "\n" + html;
}
async function fetchBootstrap(projectId, authToken) {
  const apiBase = CLI_CONFIG.auth.baseUrl + "/api/v1";
  const headers = {
    Authorization: `Bearer ${authToken}`,
    "User-Agent": "websim-cli/1.0"
  };
  const client = new WebsimApiClient({ baseUrl: apiBase, authToken });
  const projectData = await client.getProject(projectId);
  const userRes = await fetch(`${apiBase}/user`, { headers });
  if (!userRes.ok) {
    throw new Error(`Failed to fetch current user: ${userRes.status}`);
  }
  const userBody = await userRes.json();
  return {
    project: {
      id: projectData.project.id,
      title: projectData.project.title,
      description: projectData.project.description
    },
    user: {
      id: userBody.user.id,
      username: userBody.user.username,
      avatar_url: userBody.user.avatar_url
    }
  };
}
async function proxyApiRequest(req, res, authToken) {
  const targetUrl = CLI_CONFIG.auth.baseUrl + (req.url ?? "");
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);
  const headers = {
    Authorization: `Bearer ${authToken}`,
    "User-Agent": "websim-cli/1.0"
  };
  const contentType = req.headers["content-type"];
  if (contentType)
    headers["Content-Type"] = contentType;
  const accept = req.headers["accept"];
  if (accept)
    headers["Accept"] = accept;
  const upstream = await fetch(targetUrl, {
    method: req.method ?? "GET",
    headers,
    body: body.length > 0 ? body : void 0
  });
  const responseHeaders = {};
  const passthrough = ["content-type", "cache-control"];
  upstream.headers.forEach((value, key) => {
    if (passthrough.includes(key.toLowerCase())) {
      responseHeaders[key] = value;
    }
  });
  res.writeHead(upstream.status, responseHeaders);
  if (upstream.body) {
    const reader = upstream.body.getReader();
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done)
        break;
      res.write(Buffer.from(value));
    }
  }
  res.end();
}
function serveStatic(rootDir, urlPath, res) {
  let relPath = decodeURIComponent(urlPath.split("?")[0]);
  if (relPath.endsWith("/"))
    relPath += "index.html";
  const filePath = path4.join(rootDir, relPath);
  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs8.existsSync(filePath) || !fs8.statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`Not found: ${relPath}`);
    return;
  }
  const ext = path4.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  if (ext === ".html") {
    const html = fs8.readFileSync(filePath, "utf8");
    const injected = injectSdkTag(html);
    res.writeHead(200, { "Content-Type": mime });
    res.end(injected);
    return;
  }
  res.writeHead(200, { "Content-Type": mime });
  fs8.createReadStream(filePath).pipe(res);
}
var setupDevCommand = (program2) => {
  program2.command("dev").description(
    "Serve the current directory locally with a standalone websim SDK (AI/comments/identity proxied to the real API)"
  ).option("--port <port>", "Port to listen on", (v) => parseInt(v, 10), 8787).option("--dir <dir>", "Directory to serve (defaults to cwd)").action(async (options) => {
    try {
      const rootDir = path4.resolve(options.dir ?? process.cwd());
      const authToken = await getAuthToken();
      const client = new WebsimApiClient({
        baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
        authToken
      });
      const projectId = client.readWebsimConfig(rootDir);
      if (!projectId) {
        throw new Error(
          `No .websim.json found in ${rootDir} \u2014 run this from a cloned project directory`
        );
      }
      console.log(`Fetching project + user info for local SDK...`);
      const bootstrap = await fetchBootstrap(projectId, authToken);
      console.log(
        `Project: ${bootstrap.project.title ?? projectId} | acting as @${bootstrap.user.username}`
      );
      const server = http.createServer((req, res) => {
        const urlPath = req.url ?? "/";
        if (urlPath === "/__websim_local_sdk.js") {
          res.writeHead(200, {
            "Content-Type": "application/javascript; charset=utf-8"
          });
          res.end(SDK_SOURCE);
          return;
        }
        if (urlPath.startsWith("/__websim/bootstrap")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(bootstrap));
          return;
        }
        if (urlPath.startsWith("/api/")) {
          proxyApiRequest(req, res, authToken).catch((error) => {
            console.error(`[proxy] ${req.method} ${urlPath} failed:`, error);
            if (!res.headersSent) {
              res.writeHead(502, { "Content-Type": "application/json" });
            }
            res.end(JSON.stringify({ error: "local proxy error" }));
          });
          return;
        }
        serveStatic(rootDir, urlPath, res);
      });
      server.listen(options.port, () => {
        console.log(`
Serving ${rootDir}`);
        console.log(`Local dev server: http://localhost:${options.port}`);
        console.log(
          `SDK: websim.chat/imageGen/textToSpeech/comments are REAL (authenticated as @${bootstrap.user.username}); WebsimSocket is stubbed`
        );
      });
    } catch (error) {
      handleError(error);
    }
  });
};

// experimental/websim-cli/src/commands/experiment.ts
function makeClient(authToken) {
  return new WebsimApiClient({
    baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
    authToken
  });
}
function resolveProjectId(client, explicit) {
  const projectId = explicit ?? client.readWebsimConfig(process.cwd()) ?? void 0;
  if (!projectId) {
    throw new Error(
      "No project ID provided and no .websim.json found in current directory"
    );
  }
  return projectId;
}
var setupExperimentCommands = (program2) => {
  const experiment = program2.command("experiment").description("Multi-arm A/B experiments across project revisions");
  experiment.command("start").description(
    "Start an experiment: visitors are bucketed across the given revision versions"
  ).requiredOption(
    "--arms <versions>",
    "Comma-separated revision versions, with optional :weight (e.g. 3,5:2,7)"
  ).argument("[project-id]", "Project ID (optional if .websim.json exists)").action(async (projectIdArg, options) => {
    try {
      const client = makeClient(await getAuthToken());
      const projectId = resolveProjectId(client, projectIdArg);
      const arms = options.arms.split(",").map((spec) => {
        const [versionStr, weightStr] = spec.trim().split(":");
        const revision_version = parseInt(versionStr, 10);
        const weight = weightStr ? parseFloat(weightStr) : 1;
        if (!Number.isFinite(revision_version) || revision_version <= 0) {
          throw new Error(`Invalid arm version: ${spec}`);
        }
        return { revision_version, weight };
      });
      const result = await client.startExperiment(projectId, arms);
      console.log(`Experiment started: ${result.experiment.id}`);
      for (const arm of result.experiment.arms) {
        console.log(
          `  arm v${arm.revision_version}  weight ${arm.weight}  ${CLI_CONFIG.webBaseUrl}/p/${projectId}/${arm.revision_version}`
        );
      }
      console.log(
        `Visitors to the project's canonical/share URLs are now bucketed across these arms.`
      );
    } catch (error) {
      handleError(error);
    }
  });
  experiment.command("stop").description("Stop the active experiment (visitors return to current)").argument("[project-id]", "Project ID (optional if .websim.json exists)").action(async (projectIdArg) => {
    try {
      const client = makeClient(await getAuthToken());
      const projectId = resolveProjectId(client, projectIdArg);
      await client.stopExperiment(projectId);
      console.log("Experiment stopped.");
    } catch (error) {
      handleError(error);
    }
  });
  experiment.command("status").description("Show the active experiment, if any").argument("[project-id]", "Project ID (optional if .websim.json exists)").action(async (projectIdArg) => {
    try {
      const client = makeClient(await getAuthToken());
      const projectId = resolveProjectId(client, projectIdArg);
      const { experiment: experiment2 } = await client.getExperiment(projectId);
      if (!experiment2) {
        console.log("No active experiment.");
        return;
      }
      console.log(`Experiment ${experiment2.id}`);
      console.log(`  started: ${new Date(experiment2.created_at).toLocaleString()}`);
      for (const arm of experiment2.arms) {
        console.log(`  arm v${arm.revision_version}  weight ${arm.weight}`);
      }
    } catch (error) {
      handleError(error);
    }
  });
  experiment.command("stats").description("Per-arm playtime stats (visitors, avg/median playtime)").argument("[project-id]", "Project ID (optional if .websim.json exists)").option("--json", "Output raw JSON").action(async (projectIdArg, options) => {
    try {
      const client = makeClient(await getAuthToken());
      const projectId = resolveProjectId(client, projectIdArg);
      const stats = await client.getExperimentStats(projectId);
      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }
      console.log(
        `Experiment ${stats.experiment_id} (since ${new Date(stats.since).toLocaleString()})
`
      );
      console.log(
        "arm".padEnd(8) + "visitors".padEnd(10) + "avg playtime".padEnd(14) + "median".padEnd(10) + "total"
      );
      for (const arm of stats.arms) {
        console.log(
          `v${arm.arm}`.padEnd(8) + String(arm.visitors).padEnd(10) + `${arm.avg_playtime_s}s`.padEnd(14) + `${arm.median_playtime_s}s`.padEnd(10) + `${arm.total_playtime_s}s`
        );
      }
    } catch (error) {
      if (isApiError(error, "No active experiment for this project")) {
        console.log("No active experiment.");
        return;
      }
      handleError(error);
    }
  });
};

// node_modules/.pnpm/tiny-invariant@1.3.3_patch_hash=cfc0e5645bb83b7f2fc8de701be1763c59fe97d8b708ed224058189dc1eeec53/node_modules/tiny-invariant/dist/esm/tiny-invariant.js
var isProduction = process.env.NODE_ENV === "production";
var prefix = "Invariant failed";
function invariant(condition, message) {
  if (condition) {
    return;
  }
  if (isProduction) {
    throw new Error(prefix);
  }
  var provided = typeof message === "function" ? message() : message;
  var value = provided ? "".concat(prefix, ": ").concat(provided) : prefix;
  throw new Error(value);
}

// packages/core/src/models/models.ts
var azureOpenAIModels = {
  "azure-openai/gpt-5": {
    provider_model_id: "gpt-5",
    id: "azure-openai/gpt-5",
    provider: "azure-openai",
    maxTokens: 128e3,
    systemPromptUnsupported: true,
    useMaxCompletionTokens: true,
    temperatureUnsupported: true,
    predictionUnsupported: true,
    preferFullPage: true,
    chatty: true,
    reasoning_effort: "low",
    responsesApi: true,
    summary: "auto",
    supportsToolCalls: true,
    supportsPrefill: false,
    priceData: {
      input_mtok_cost: 1.25,
      output_mtok_cost: 10
    }
  },
  "azure-openai/gpt-5-mini": {
    provider_model_id: "gpt-5-mini",
    id: "azure-openai/gpt-5-mini",
    provider: "azure-openai",
    maxTokens: 128e3,
    systemPromptUnsupported: true,
    useMaxCompletionTokens: true,
    temperatureUnsupported: true,
    predictionUnsupported: true,
    preferFullPage: true,
    chatty: true,
    reasoning_effort: "low",
    responsesApi: true,
    summary: "auto",
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 0.25,
      output_mtok_cost: 2
    }
  },
  "azure-openai/gpt-5.1": {
    provider_model_id: "gpt-5.1",
    id: "azure-openai/gpt-5.1",
    provider: "azure-openai",
    maxTokens: 128e3,
    systemPromptUnsupported: true,
    useMaxCompletionTokens: true,
    temperatureUnsupported: true,
    predictionUnsupported: true,
    preferFullPage: true,
    chatty: true,
    reasoning_effort: "low",
    responsesApi: true,
    summary: "auto",
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 1.25,
      output_mtok_cost: 10
    }
  }
};
var azureOpenAINanoModels = {
  "azure-openai-nano/gpt-5.4-nano": {
    provider_model_id: "gpt-5.4-nano",
    id: "azure-openai-nano/gpt-5.4-nano",
    provider: "azure-openai-nano",
    maxTokens: 128e3,
    useMaxCompletionTokens: true,
    temperatureUnsupported: true,
    predictionUnsupported: true,
    reasoning_effort: "none",
    responsesApi: true,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 0.05,
      output_mtok_cost: 0.4
    }
  }
};
var openAIModels = {
  "gpt-4o-mini": {
    provider_model_id: "gpt-4o-mini",
    id: "gpt-4o-mini",
    provider: "openai"
  },
  "openai/gpt-5-mini": {
    provider_model_id: "gpt-5-mini",
    id: "openai/gpt-5-mini",
    provider: "openai",
    maxTokens: 128e3,
    useMaxCompletionTokens: true,
    temperatureUnsupported: true,
    predictionUnsupported: true,
    preferFullPage: true,
    chatty: true,
    reasoning_effort: "low",
    responsesApi: true,
    summary: "auto",
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 0.25,
      output_mtok_cost: 2
    }
  },
  "openai/gpt-5-nano": {
    provider_model_id: "gpt-5-nano",
    id: "openai/gpt-5-nano",
    provider: "openai",
    maxTokens: 128e3,
    useMaxCompletionTokens: true,
    temperatureUnsupported: true,
    predictionUnsupported: true,
    reasoning_effort: "minimal",
    responsesApi: true,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 0.05,
      output_mtok_cost: 0.4
    }
  },
  "openai/gpt-5.1": {
    provider_model_id: "gpt-5.1",
    id: "openai/gpt-5.1",
    provider: "openai",
    maxTokens: 128e3,
    useMaxCompletionTokens: true,
    temperatureUnsupported: true,
    predictionUnsupported: true,
    preferFullPage: true,
    chatty: true,
    reasoning_effort: "low",
    responsesApi: true,
    summary: "auto",
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 1.25,
      output_mtok_cost: 10
    }
  },
  "openai/gpt-5.1-high": {
    provider_model_id: "gpt-5.1",
    id: "openai/gpt-5.1-high",
    provider: "openai",
    maxTokens: 128e3,
    useMaxCompletionTokens: true,
    temperatureUnsupported: true,
    predictionUnsupported: true,
    preferFullPage: true,
    chatty: true,
    reasoning_effort: "high",
    responsesApi: true,
    summary: "auto",
    supportsToolCalls: true
  },
  "ft:gpt-4o-mini-2024-07-18:websim:apply-38-reviewed-long-examples-nov-20:AVqoErZD": {
    provider_model_id: "ft:gpt-4o-mini-2024-07-18:websim:apply-38-reviewed-long-examples-nov-20:AVqoErZD",
    id: "ft:gpt-4o-mini-2024-07-18:websim:apply-38-reviewed-long-examples-nov-20:AVqoErZD",
    provider: "openai",
    chatty: true
  }
};
var cerebrasModels = {
  "cerebras/llama3.1-8b": {
    provider_model_id: "llama3.1-8b",
    id: "cerebras/llama3.1-8b",
    provider: "cerebras"
  },
  "cerebras/llama-3.3-70b": {
    provider_model_id: "llama-3.3-70b",
    id: "cerebras/llama-3.3-70b",
    provider: "cerebras"
  }
};
var togetherModels = {
  "together:meta-llama/Llama-3.3-70B-Instruct-Turbo": {
    tokenizer: "cl100k_base",
    provider_model_id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    id: "together:meta-llama/Llama-3.3-70B-Instruct-Turbo",
    provider: "together",
    supportsPrefill: true,
    timeout: 1e3 * 10
  }
};
var openRouterModels = {
  "openrouter:meta-llama/llama-3.3-70b-instruct/together": {
    tokenizer: "cl100k_base",
    provider_model_id: "meta-llama/llama-3.3-70b-instruct",
    id: "openrouter:meta-llama/llama-3.3-70b-instruct/together",
    provider: "openrouter",
    supportsPrefill: true,
    additional_info: {
      provider: {
        order: ["Together"],
        allow_fallbacks: false
      }
    }
  },
  "openrouter:meta-llama/llama-3.3-70b-instruct": {
    tokenizer: "cl100k_base",
    provider_model_id: "meta-llama/llama-3.3-70b-instruct",
    id: "openrouter:meta-llama/llama-3.3-70b-instruct",
    provider: "openrouter",
    supportsPrefill: true
  },
  "anthropic/claude-3-5-haiku": {
    maxTokens: 8192,
    provider_model_id: "anthropic/claude-3-5-haiku",
    id: "anthropic/claude-3-5-haiku",
    provider: "openrouter",
    supportsPrefill: true
  },
  "openrouter/openai/gpt-5-mini": {
    provider_model_id: "openai/gpt-5-mini",
    id: "openrouter/openai/gpt-5-mini",
    provider: "openrouter",
    temperatureUnsupported: true,
    priceData: {
      input_mtok_cost: 0.25,
      output_mtok_cost: 2
    }
  },
  "openrouter/openai/gpt-5.1": {
    provider_model_id: "openai/gpt-5.1",
    id: "openrouter/openai/gpt-5.1",
    provider: "openrouter",
    temperatureUnsupported: true,
    priceData: {
      input_mtok_cost: 1.25,
      output_mtok_cost: 10
    }
  },
  "openrouter/openai/gpt-5.1-high": {
    provider_model_id: "openai/gpt-5.1-high",
    id: "openrouter/openai/gpt-5.1-high",
    provider: "openrouter",
    temperatureUnsupported: true
  },
  "deepseek/deepseek-coder": {
    provider_model_id: "deepseek/deepseek-coder",
    id: "deepseek/deepseek-coder",
    provider: "openrouter"
  },
  "moonshotai/kimi-k2": {
    provider_model_id: "moonshotai/kimi-k2-0905",
    id: "moonshotai/kimi-k2",
    provider: "openrouter",
    supportsPrefill: false,
    additional_info: {
      provider: {
        order: ["groq", "moonshotai"]
      }
    },
    priceData: {
      input_mtok_cost: 1,
      output_mtok_cost: 3
    }
  },
  // Kimi K2.7 Code: coding-focused reasoning model (no non-thinking mode).
  // Groq no longer hosts any Kimi, so route via Moonshot AI on OpenRouter.
  "moonshotai/kimi-k2.7-code": {
    provider_model_id: "moonshotai/kimi-k2.7-code",
    id: "moonshotai/kimi-k2.7-code",
    provider: "openrouter",
    supportsPrefill: false,
    additional_info: {
      provider: {
        order: ["moonshotai"]
      }
    },
    priceData: {
      input_mtok_cost: 0.95,
      output_mtok_cost: 4
    }
  }
};
var sambaModels = {
  "samba:Meta-Llama-3.3-70B-Instruct": {
    provider_model_id: "Meta-Llama-3.3-70B-Instruct",
    id: "samba:Meta-Llama-3.3-70B-Instruct",
    provider: "samba",
    supportsPrefill: true,
    timeout: 1e3 * 15
  }
};
var fireworksModels = {
  "fireworks:accounts/fireworks/models/deepseek-v3-0324": {
    provider_model_id: "accounts/fireworks/models/deepseek-v3-0324",
    id: "fireworks:accounts/fireworks/models/deepseek-v3-0324",
    provider: "fireworks",
    supportsPrefill: false
  },
  "fireworks:accounts/fireworks/models/deepseek-v3p1": {
    provider_model_id: "accounts/fireworks/models/deepseek-v3p1",
    id: "fireworks:accounts/fireworks/models/deepseek-v3p1",
    provider: "fireworks",
    supportsPrefill: false,
    supportsToolCalls: true
  },
  "fireworks:accounts/fireworks/models/deepseek-v4-pro": {
    provider_model_id: "accounts/fireworks/models/deepseek-v4-pro",
    id: "fireworks:accounts/fireworks/models/deepseek-v4-pro",
    provider: "fireworks",
    supportsPrefill: false,
    supportsToolCalls: true
  },
  "fireworks:accounts/fireworks/models/llama-v3p3-70b-instruct": {
    tokenizer: "cl100k_base",
    provider_model_id: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    id: "fireworks:accounts/fireworks/models/llama-v3p3-70b-instruct",
    provider: "fireworks",
    supportsPrefill: true,
    predictionUnsupported: true
  }
};
var relaceModels = {
  relace: {
    provider_model_id: "relace",
    id: "relace",
    provider: "relace"
  }
};
var morphModels = {
  morph: {
    provider_model_id: "morph-v3-fast",
    id: "morph",
    provider: "morph"
  },
  "morph-large": {
    provider_model_id: "morph-v3-large",
    id: "morph-large",
    provider: "morph"
  }
};
var vertexAnthropicModels = {
  "vertex-anthropic/claude-sonnet-4": {
    provider_model_id: "claude-sonnet-4@20250514",
    id: "vertex-anthropic/claude-sonnet-4",
    maxTokens: 64e3,
    provider: "vertex-anthropic",
    supportsPrefill: true,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 3,
      output_mtok_cost: 15
    }
  },
  "vertex-anthropic/claude-sonnet-4-5": {
    provider_model_id: "claude-sonnet-4-5@20250929",
    id: "vertex-anthropic/claude-sonnet-4-5",
    maxTokens: 64e3,
    provider: "vertex-anthropic",
    supportsPrefill: true,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 3,
      output_mtok_cost: 15
    }
  },
  "vertex-anthropic/sonnet-4-thinking": {
    provider_model_id: "claude-sonnet-4@20250514",
    id: "vertex-anthropic/sonnet-4-thinking",
    maxTokens: 5e4,
    provider: "vertex-anthropic",
    supportsPrefill: false,
    supportsThinking: true,
    budget_tokens: 5e3,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 3,
      output_mtok_cost: 15
    }
  },
  "vertex-anthropic/sonnet-4-5-thinking": {
    provider_model_id: "claude-sonnet-4-5@20250929",
    id: "vertex-anthropic/sonnet-4-5-thinking",
    maxTokens: 5e4,
    provider: "vertex-anthropic",
    supportsPrefill: false,
    supportsThinking: true,
    budget_tokens: 5e3,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 3,
      output_mtok_cost: 15
    }
  },
  "vertex-anthropic/claude-haiku-4-5": {
    provider_model_id: "claude-haiku-4-5@20251001",
    id: "vertex-anthropic/claude-haiku-4-5",
    maxTokens: 8192,
    provider: "vertex-anthropic",
    supportsPrefill: true,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 1,
      output_mtok_cost: 5
    }
  },
  "vertex-anthropic/haiku-4-5-thinking": {
    provider_model_id: "claude-haiku-4-5@20251001",
    id: "vertex-anthropic/haiku-4-5-thinking",
    maxTokens: 5e4,
    provider: "vertex-anthropic",
    supportsPrefill: false,
    supportsThinking: true,
    budget_tokens: 5e3,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 1,
      output_mtok_cost: 5
    }
  }
};
var anthropicModels = {
  "claude-sonnet-4-20250514": {
    provider_model_id: "claude-sonnet-4-20250514",
    id: "claude-sonnet-4-20250514",
    maxTokens: 64e3,
    provider: "anthropic",
    supportsPrefill: true,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 3,
      output_mtok_cost: 15
    }
  },
  "claude-sonnet-4-5-20250929": {
    provider_model_id: "claude-sonnet-4-5-20250929",
    id: "claude-sonnet-4-5-20250929",
    maxTokens: 64e3,
    provider: "anthropic",
    supportsPrefill: true,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 3,
      output_mtok_cost: 15
    }
  },
  "claude-3-5-haiku-20241022": {
    provider_model_id: "claude-3-5-haiku-20241022",
    id: "claude-3-5-haiku-20241022",
    maxTokens: 8192,
    provider: "anthropic",
    supportsPrefill: true
  },
  "anthropic/sonnet-4-thinking": {
    provider_model_id: "claude-sonnet-4-20250514",
    id: "anthropic/sonnet-4-thinking",
    maxTokens: 5e4,
    provider: "anthropic",
    supportsPrefill: false,
    supportsThinking: true,
    budget_tokens: 5e3,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 3,
      output_mtok_cost: 15
    }
  },
  "anthropic/sonnet-4-5-thinking": {
    provider_model_id: "claude-sonnet-4-5-20250929",
    id: "anthropic/sonnet-4-5-thinking",
    maxTokens: 5e4,
    provider: "anthropic",
    supportsPrefill: false,
    supportsThinking: true,
    budget_tokens: 5e3,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 3,
      output_mtok_cost: 15
    }
  },
  "claude-haiku-4-5-20251001": {
    provider_model_id: "claude-haiku-4-5-20251001",
    id: "claude-haiku-4-5-20251001",
    maxTokens: 8192,
    provider: "anthropic",
    supportsPrefill: true,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 1,
      output_mtok_cost: 5
    }
  },
  "anthropic/haiku-4-5-thinking": {
    provider_model_id: "claude-haiku-4-5-20251001",
    id: "anthropic/haiku-4-5-thinking",
    maxTokens: 5e4,
    provider: "anthropic",
    supportsPrefill: false,
    supportsThinking: true,
    budget_tokens: 5e3,
    supportsToolCalls: true,
    priceData: {
      input_mtok_cost: 1,
      output_mtok_cost: 5
    }
  }
};
var groqModels = {
  "groq/llama-3-70b-versatile": {
    id: "groq/llama-3-70b-versatile",
    provider_model_id: "llama-3.3-70b-versatile",
    provider: "groq"
  },
  "groq/llama-3.1-8b-instant": {
    id: "groq/llama-3.1-8b-instant",
    provider_model_id: "llama-3.1-8b-instant",
    provider: "groq"
  },
  "groq/moonshotai/kimi-k2-instruct": {
    id: "groq/moonshotai/kimi-k2-instruct",
    provider_model_id: "moonshotai/Kimi-K2-Instruct-0905",
    provider: "groq",
    maxTokens: 16384,
    // max_completion_tokens
    priceData: {
      input_mtok_cost: 1,
      output_mtok_cost: 3
    }
  }
};
var googleModels = {
  "google:gemini-2.0-flash": {
    id: "google:gemini-2.0-flash",
    provider_model_id: "models/gemini-2.0-flash-001",
    provider: "google",
    supportsPrefill: true
  },
  "google:gemini-2.5-pro-preview-05-06": {
    id: "google:gemini-2.5-pro-preview-05-06",
    provider_model_id: "models/gemini-2.5-pro-preview-05-06",
    provider: "google",
    supportsPrefill: false,
    supportsThinking: true,
    maxTokens: 65535,
    priceData: (input_tokens) => input_tokens > 2e5 ? { input_mtok_cost: 2.5, output_mtok_cost: 15 } : { input_mtok_cost: 1.25, output_mtok_cost: 10 }
  },
  "google:gemini-2.5-pro-preview-06-05": {
    id: "google:gemini-2.5-pro-preview-06-05",
    provider_model_id: "models/gemini-2.5-pro-preview-06-05",
    provider: "google",
    supportsPrefill: false,
    supportsThinking: true,
    thinking_budget: 1500,
    maxTokens: 65535,
    priceData: (input_tokens) => input_tokens > 2e5 ? { input_mtok_cost: 2.5, output_mtok_cost: 15 } : { input_mtok_cost: 1.25, output_mtok_cost: 10 }
  },
  "google:gemini-2.5-flash-preview-09-2025-thinking": {
    id: "google:gemini-2.5-flash-preview-09-2025-thinking",
    provider_model_id: "models/gemini-2.5-flash-preview-09-2025",
    provider: "google",
    supportsPrefill: false,
    supportsThinking: true,
    thinking_budget: 8e3,
    maxTokens: 65535,
    priceData: {
      input_mtok_cost: 0.3,
      output_mtok_cost: 2.5
    }
  },
  "google:gemini-2.5-flash-preview-09-2025": {
    id: "google:gemini-2.5-flash-preview-09-2025",
    provider_model_id: "models/gemini-2.5-flash-preview-09-2025",
    provider: "google",
    supportsPrefill: false,
    supportsThinking: true,
    thinking_budget: 0,
    maxTokens: 65535,
    priceData: {
      input_mtok_cost: 0.3,
      output_mtok_cost: 2.5
    }
  },
  "google:gemini-3.1-pro-preview": {
    id: "google:gemini-3.1-pro-preview",
    provider_model_id: "models/gemini-3.1-pro-preview",
    provider: "google",
    supportsPrefill: false,
    supportsThinking: true,
    thinking_level: "low",
    maxTokens: 65535,
    priceData: (input_tokens) => input_tokens > 2e5 ? { input_mtok_cost: 4, output_mtok_cost: 18 } : { input_mtok_cost: 2, output_mtok_cost: 12 }
  },
  "google:gemini-3-flash-preview": {
    id: "google:gemini-3-flash-preview",
    provider_model_id: "models/gemini-3-flash-preview",
    provider: "google",
    supportsPrefill: false,
    supportsThinking: true,
    thinking_level: "medium",
    maxTokens: 65535,
    priceData: {
      input_mtok_cost: 0.5,
      output_mtok_cost: 3
    }
  }
};
var providers = {
  together: togetherModels,
  anthropic: anthropicModels,
  openrouter: openRouterModels,
  openai: openAIModels,
  "azure-openai": azureOpenAIModels,
  "azure-openai-nano": azureOpenAINanoModels,
  "vertex-anthropic": vertexAnthropicModels,
  cerebras: cerebrasModels,
  fireworks: fireworksModels,
  groq: groqModels,
  google: googleModels,
  samba: sambaModels,
  relace: relaceModels,
  morph: morphModels
};
var models = {};
for (const providerModels of Object.values(providers)) {
  for (const [id, model] of Object.entries(providerModels)) {
    invariant(!models[id], `Duplicate model id: ${id}`);
    models[id] = model;
    invariant(
      models[id].id === id,
      `Model id mismatch: ${id} !== ${models[id].id}`
    );
  }
}
var aliases = {
  // morph uses Morph API with basic format
  // (instruction on separate line before filename, controlled at planning phase)
  morph: {
    models: [morphModels["morph"]]
  },
  // relace-plus uses Relace API with alternative basic format
  // (instruction on separate line before filename, controlled at planning phase)
  "relace-plus": {
    models: [relaceModels["relace"]]
  },
  // gemini-flash alias for backwards compatibility - redirects to gemini-3-flash
  "gemini-flash": {
    models: [googleModels["google:gemini-3-flash-preview"]]
  },
  "gemini-flash-legacy": {
    models: [googleModels["google:gemini-2.0-flash"]]
  },
  // Selection id kept as "deepseek-v3p1" for stored-preference stability;
  // now resolves to DeepSeek V4 Pro.
  "deepseek-v3p1": {
    models: [
      fireworksModels["fireworks:accounts/fireworks/models/deepseek-v4-pro"]
    ]
  },
  "fireworks:accounts/fireworks/models/llama-v3p3-70b-instruct": {
    models: [
      fireworksModels["fireworks:accounts/fireworks/models/llama-v3p3-70b-instruct"],
      togetherModels["together:meta-llama/Llama-3.3-70B-Instruct-Turbo"],
      openRouterModels["openrouter:meta-llama/llama-3.3-70b-instruct"]
    ]
  },
  "gpt-5-mini": {
    models: [azureOpenAIModels["azure-openai/gpt-5-mini"]]
  },
  "gpt-5-nano": {
    models: [azureOpenAINanoModels["azure-openai-nano/gpt-5.4-nano"]]
  },
  "gpt-5.1": {
    models: [azureOpenAIModels["azure-openai/gpt-5.1"]]
  },
  "gpt-5.1-high": {
    models: [
      openAIModels["openai/gpt-5.1-high"],
      openRouterModels["openrouter/openai/gpt-5.1-high"]
    ]
  },
  "deepseek-coder": {
    models: [openRouterModels["deepseek/deepseek-coder"]]
  },
  // Selection id kept as "kimi-k2" for stored-preference stability;
  // now resolves to Kimi K2.7 Code via OpenRouter (Groq no longer hosts Kimi).
  "kimi-k2": {
    models: [openRouterModels["moonshotai/kimi-k2.7-code"]]
  },
  haiku: {
    models: [
      anthropicModels["claude-3-5-haiku-20241022"],
      openRouterModels["anthropic/claude-3-5-haiku"]
    ]
  },
  "sonnet-4.5": {
    models: [
      vertexAnthropicModels["vertex-anthropic/claude-sonnet-4-5"],
      anthropicModels["claude-sonnet-4-5-20250929"]
    ]
  },
  "sonnet-4.5-thinking": {
    models: [
      vertexAnthropicModels["vertex-anthropic/sonnet-4-5-thinking"],
      anthropicModels["anthropic/sonnet-4-5-thinking"]
    ]
  },
  "gemini-3.1-pro": {
    models: [googleModels["google:gemini-3.1-pro-preview"]]
  },
  "gemini-3-flash": {
    models: [googleModels["google:gemini-3-flash-preview"]]
  }
};
for (const [alias, { models: models2 }] of Object.entries(aliases)) {
  for (let i = 0; i < models2.length; i++) {
    const model = models2[i];
    invariant(model !== void 0, `Model ${alias} not found for index ${i}`);
  }
}

// packages/core/src/models/model-selection.ts
var modelSelections = [
  // Free Models
  {
    family: "Moonshot",
    id: "kimi-k2",
    cost: 0.5,
    label: "Kimi K2.7",
    description: "Moonshot AI's Kimi K2.7 Code model via OpenRouter",
    lastUpdated: "2026-06-12",
    hidden: false
  },
  {
    family: "Anthropic",
    id: "haiku",
    cost: 1,
    label: "Haiku 3.5",
    description: "Claude 3.5",
    lastUpdated: "2024-10-22",
    hidden: true
  },
  // Premium models
  {
    family: "Google",
    id: "gemini-3.1-pro",
    cost: 4,
    label: "Gemini 3.1 Pro",
    description: "Google's newest 3.1 pro model with extended thinking",
    lastUpdated: "2025-01-02",
    hidden: false,
    premium: true
  },
  {
    family: "Google",
    id: "gemini-3-flash",
    cost: 1,
    label: "Gemini 3 Flash",
    description: "Google's newest fast model",
    lastUpdated: "2025-01-02",
    hidden: false
  },
  {
    family: "OpenAI",
    id: "gpt-5-mini",
    cost: 0,
    label: "GPT-5 Mini",
    description: "OpenAI's efficient new model",
    lastUpdated: "2025-08-07",
    premium: false,
    hidden: false
  },
  {
    family: "OpenAI",
    id: "gpt-5.1",
    cost: 1,
    label: "GPT-5.1",
    description: "OpenAI's improved GPT-5.1 model with standard reasoning",
    lastUpdated: "2025-11-17",
    premium: true
  },
  {
    family: "DeepSeek",
    id: "deepseek-v3p1",
    cost: 0,
    label: "DeepSeek V4",
    description: "DeepSeek V4 Pro via Fireworks",
    lastUpdated: "2026-04-24",
    hidden: true
  },
  {
    family: "Anthropic",
    id: "sonnet-4.5",
    cost: 5,
    label: "Sonnet 4.5",
    description: "Claude Sonnet 4.5",
    lastUpdated: "2025-09-29",
    premium: true
  },
  {
    family: "Anthropic",
    id: "sonnet-4.5-thinking",
    cost: 8,
    label: "Sonnet 4.5 Thinking",
    description: "Claude Sonnet 4.5 with extended thinking enabled (budget_tokens: 5000)",
    lastUpdated: "2025-09-29",
    premium: true
  }
];
var modelSelectionsMap = new Map(
  modelSelections.map((model) => [model.id, model])
);
var EXTRA_PREMIUM_MODELS = modelSelections.filter(
  (model) => !model.retired && (model.id === "sonnet-4.5-thinking" || model.id === "sonnet-4.5" || model.id === "gemini-3.1-pro")
).map((model) => model.id);
var PREMIUM_MODELS = modelSelections.filter(
  (model) => model.cost > 0 && !model.retired && !EXTRA_PREMIUM_MODELS.includes(model.id)
).map((model) => model.id);
var EXCLUSIVE_MODELS = modelSelections.filter((model) => model.exclusive && !model.retired).map((model) => model.id);
var FREE_MODELS = modelSelections.filter((model) => model.cost === 0 && !model.retired).map((model) => model.id);

// experimental/websim-cli/src/commands/models.ts
function setupModelsCommands(program2) {
  const modelsCommand = program2.command("models").description("List available AI models");
  modelsCommand.command("list").alias("ls").description("List all available models").option("-p, --provider <provider>", "Filter by provider").option("-j, --json", "Output as JSON").option("-v, --verbose", "Show verbose model details").action((options) => {
    const modelList = Object.values(models);
    let filteredModels = modelList;
    if (options.provider) {
      filteredModels = modelList.filter(
        (model) => model.provider === options.provider
      );
    }
    if (options.json) {
      console.log(JSON.stringify(filteredModels, null, 2));
      return;
    }
    if (filteredModels.length === 0) {
      console.log("No models found");
      return;
    }
    console.log("\n\u{1F916} Available Models\n");
    const groupedByProvider = filteredModels.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    }, {});
    for (const [provider, providerModels] of Object.entries(groupedByProvider)) {
      console.log(`
${provider}:`);
      for (const model of providerModels) {
        if (options.verbose) {
          console.log(`  ${model.id}`);
          console.log(`    Provider Model ID: ${model.provider_model_id}`);
          if (model.maxTokens) {
            console.log(`    Max Tokens: ${model.maxTokens}`);
          }
          if (model.supportsPrefill) {
            console.log(`    Supports Prefill: ${model.supportsPrefill}`);
          }
          if (model.supportsThinking) {
            console.log(`    Supports Thinking: ${model.supportsThinking}`);
          }
          if (model.supportsToolCalls) {
            console.log(`    Supports Tool Calls: ${model.supportsToolCalls}`);
          }
          if (model.reasoning_effort) {
            console.log(`    Reasoning Effort: ${model.reasoning_effort}`);
          }
        } else {
          const features = [];
          if (model.supportsThinking)
            features.push("thinking");
          if (model.supportsToolCalls)
            features.push("tools");
          if (model.reasoning_effort)
            features.push(`reasoning:${model.reasoning_effort}`);
          const featuresStr = features.length > 0 ? ` [${features.join(", ")}]` : "";
          console.log(`  ${model.id}${featuresStr}`);
        }
      }
    }
    console.log(`
Total: ${filteredModels.length} models`);
  });
  modelsCommand.command("aliases").description("List model aliases").option("-j, --json", "Output as JSON").action((options) => {
    if (options.json) {
      const aliasesWithNames = Object.entries(aliases).reduce((acc, [alias, config]) => {
        acc[alias] = {
          models: config.models.map((m) => m?.id).filter(Boolean),
          preferProviders: config.preferProviders,
          succeededBy: config.succeededBy
        };
        return acc;
      }, {});
      console.log(JSON.stringify(aliasesWithNames, null, 2));
      return;
    }
    console.log("\n\u{1F517} Model Aliases\n");
    for (const [alias, config] of Object.entries(aliases)) {
      const modelIds = config.models.map((m) => m?.id).filter(Boolean);
      console.log(`${alias}:`);
      for (const id of modelIds) {
        console.log(`  \u2192 ${id}`);
      }
      if (config.preferProviders) {
        console.log(`  Preferred: ${config.preferProviders.join(", ")}`);
      }
      if (config.succeededBy) {
        console.log(`  Succeeded by: ${config.succeededBy}`);
      }
    }
  });
  modelsCommand.command("providers").description("List all providers").action(() => {
    const providers2 = [...new Set(Object.values(models).map((m) => m.provider))];
    console.log("\n\u2601\uFE0F  Providers\n");
    for (const provider of providers2.sort()) {
      const count = Object.values(models).filter((m) => m.provider === provider).length;
      console.log(`  ${provider} (${count} models)`);
    }
  });
  modelsCommand.command("info <model>").description("Show detailed information about a specific model or alias").action((modelId) => {
    const model = models[modelId];
    const alias = aliases[modelId];
    if (model) {
      console.log(`
\u{1F4CB} Model: ${model.id}
`);
      console.log(`Provider: ${model.provider}`);
      console.log(`Provider Model ID: ${model.provider_model_id}`);
      if (model.maxTokens) {
        console.log(`Max Tokens: ${model.maxTokens}`);
      }
      console.log("\nFeatures:");
      console.log(`  Supports Prefill: ${model.supportsPrefill ? "\u2713" : "\u2717"}`);
      console.log(`  Supports Thinking: ${model.supportsThinking ? "\u2713" : "\u2717"}`);
      console.log(`  Supports Tool Calls: ${model.supportsToolCalls ? "\u2713" : "\u2717"}`);
      if (model.reasoning_effort) {
        console.log(`  Reasoning Effort: ${model.reasoning_effort}`);
      }
      if (model.budget_tokens) {
        console.log(`  Budget Tokens: ${model.budget_tokens}`);
      }
      if (model.thinking_budget) {
        console.log(`  Thinking Budget: ${model.thinking_budget}`);
      }
      console.log("\nCapabilities:");
      console.log(`  System Prompt: ${!model.systemPromptUnsupported ? "\u2713" : "\u2717"}`);
      console.log(`  Temperature: ${!model.temperatureUnsupported ? "\u2713" : "\u2717"}`);
      console.log(`  Predictions: ${!model.predictionUnsupported ? "\u2713" : "\u2717"}`);
      console.log(`  Streaming: ${!model.streamUnsupported ? "\u2713" : "\u2717"}`);
      if (model.chatty) {
        console.log("\n\u26A0\uFE0F  This model tends to produce chatty responses");
      }
      if (model.preferFullPage) {
        console.log("\n\u{1F4C4} This model prefers full page generation");
      }
    } else if (alias) {
      console.log(`
\u{1F517} Alias: ${modelId}
`);
      const modelIds = alias.models.map((m) => m?.id).filter(Boolean);
      console.log("Resolves to:");
      for (const id of modelIds) {
        const m = models[id];
        if (m) {
          console.log(`  \u2192 ${id} (${m.provider})`);
        }
      }
      if (alias.preferProviders) {
        console.log(`
Preferred Providers: ${alias.preferProviders.join(", ")}`);
      }
      if (alias.succeededBy) {
        console.log(`
Succeeded by: ${alias.succeededBy}`);
      }
    } else {
      console.error(`Model or alias "${modelId}" not found`);
      process.exit(1);
    }
  });
}

// experimental/websim-cli/src/commands/projects.ts
import path5 from "path";
async function ensureRevisionHasSite(client, revision) {
  if (revision.site_id) {
    return;
  }
  try {
    await client.createSite({
      project_id: revision.project_id,
      project_version: revision.version,
      project_revision_id: revision.id,
      content: "<!-- placeholder site created by websim-cli; content is served from project assets -->"
    });
    console.log(`Created site for revision ${revision.version}`);
  } catch (error) {
    console.warn(
      `Warning: failed to create site for revision ${revision.version}; the project may not appear in feeds or load on mobile`,
      error
    );
  }
}
async function createRevisionSite(client, revision, message) {
  try {
    await client.createSite({
      project_id: revision.project_id,
      project_version: revision.version,
      project_revision_id: revision.id,
      content: "<!-- site created by websim-cli; content is served from project assets -->",
      prompt_data_override: {
        type: "plaintext",
        text: message ?? "",
        data: null
      }
    });
    console.log(
      message ? `Created site for revision ${revision.version} (prompt: "${message}")` : `Created site for revision ${revision.version}`
    );
  } catch (error) {
    console.warn(
      `Warning: failed to create site for revision ${revision.version}; falling back to the inherited site`,
      error
    );
    await ensureRevisionHasSite(client, revision);
  }
}
var setupProjectCommands = (program2) => {
  const projects = program2.command("projects").description("Project management and information commands");
  setupProjectsCreateCommand(projects);
  setupProjectsSyncCommand(projects);
  setupProjectsPushCommand(projects);
  setupProjectsPullCommand(projects);
  setupProjectsCloneCommand(projects);
  setupProjectsGetCommand(projects);
  setupProjectsGetLineageCommand(projects);
  setupProjectsListCommand(projects);
  setupProjectsListCurrentCommand(projects);
  setupProjectsRevisionsCommand(projects);
  setupProjectsPromoteCommand(projects);
  setupSyncAlias(program2);
  setupPushAlias(program2);
  setupPullAlias(program2);
  setupCloneAlias(program2);
  setupPromoteAlias(program2);
};
function setupProjectsCreateCommand(program2) {
  program2.command("create").description("Create a new project with an initial draft revision").option("--parent-project <id>", "Parent project ID (for forking)").option("--parent-version <version>", "Parent revision version", parseInt).option("--visibility <visibility>", "Project visibility (public|private|unlisted)", "public").option("--template", "Create as template").option("--main-project <id>", "Main project ID (for branching)").option("--json", "Output raw JSON response").action((options) => {
    handleProjectsCreate(options);
  });
}
function setupProjectsSyncCommand(program2) {
  program2.command("sync").description(
    "Sync files from current directory to a new finalized revision and promote it to current"
  ).argument(
    "[project-id]",
    "Websim project ID (optional if .websim.json exists)"
  ).argument(
    "[parent-version]",
    "Parent revision version number (uses latest if not specified)",
    parseInt
  ).option(
    "--no-promote",
    "Do not promote the new revision to current (leave the live site unchanged)"
  ).option("--no-open", "Do not open the new revision in a browser").option(
    "-m, --message <text>",
    "Prompt text shown for this revision in the websim UI"
  ).action((projectId, parentVersion, options) => {
    handleSync(projectId, parentVersion, options);
  });
}
function setupSyncAlias(program2) {
  program2.command("sync", { hidden: true }).description(
    "Sync files from current directory to a new finalized revision and promote it to current"
  ).argument(
    "[project-id]",
    "Websim project ID (optional if .websim.json exists)"
  ).argument(
    "[parent-version]",
    "Parent revision version number (uses latest if not specified)",
    parseInt
  ).option(
    "--no-promote",
    "Do not promote the new revision to current (leave the live site unchanged)"
  ).option("--no-open", "Do not open the new revision in a browser").option(
    "-m, --message <text>",
    "Prompt text shown for this revision in the websim UI"
  ).action((projectId, parentVersion, options) => {
    handleSync(projectId, parentVersion, options);
  });
}
function setupProjectsPromoteCommand(program2) {
  program2.command("promote").description(
    "Promote a revision to current (live), e.g. after sync --no-promote"
  ).argument(
    "[project-id]",
    "Websim project ID (optional if .websim.json exists)"
  ).argument(
    "[version]",
    "Revision version number to promote (uses latest if not specified)",
    parseInt
  ).action((projectId, version) => {
    handlePromote(projectId, version);
  });
}
async function handlePromote(projectId, version) {
  const directoryPath = process.cwd();
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    if (!projectId) {
      projectId = client.readWebsimConfig(directoryPath) ?? void 0;
      if (!projectId) {
        throw new Error(
          "No project ID provided and no .websim.json found in current directory"
        );
      }
      console.log(`Using project ID from .websim.json: ${projectId}`);
    }
    try {
      const targetVersion = version || await client.getLatestRevisionVersion(projectId);
      await client.setProjectCurrentVersion(projectId, targetVersion);
      console.log(`Promoted revision ${targetVersion} to current (live)`);
      console.log(
        `URL: ${CLI_CONFIG.webBaseUrl}/p/${projectId}/${targetVersion}`
      );
    } catch (error) {
      if (error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handlePromote(projectId, version);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
function setupPromoteAlias(program2) {
  program2.command("promote", { hidden: true }).description(
    "Promote a revision to current (live), e.g. after sync --no-promote"
  ).argument(
    "[project-id]",
    "Websim project ID (optional if .websim.json exists)"
  ).argument(
    "[version]",
    "Revision version number to promote (uses latest if not specified)",
    parseInt
  ).action((projectId, version) => {
    handlePromote(projectId, version);
  });
}
function setupProjectsPushCommand(program2) {
  program2.command("push").description(
    "Push files from current directory to an existing Websim project revision (edits in-place)"
  ).argument(
    "[project-id]",
    "Websim project ID (optional if .websim.json exists)"
  ).argument(
    "[version]",
    "Revision version number to push to (uses latest if not specified)",
    parseInt
  ).action((projectId, version) => {
    handlePush(projectId, { version });
  });
}
function setupPushAlias(program2) {
  program2.command("push", { hidden: true }).description(
    "Push files from current directory to an existing Websim project revision (edits in-place)"
  ).argument(
    "[project-id]",
    "Websim project ID (optional if .websim.json exists)"
  ).argument(
    "[version]",
    "Revision version number to push to (uses latest if not specified)",
    parseInt
  ).action((projectId, version) => {
    handlePush(projectId, { version });
  });
}
function setupProjectsPullCommand(program2) {
  program2.command("pull").description("Pull files from a Websim project to current directory").argument(
    "[project-id]",
    "Websim project ID (optional if .websim.json exists)"
  ).argument(
    "[version]",
    "Revision version number to pull (uses latest if not specified)",
    parseInt
  ).action((projectId, version) => {
    handlePull(projectId, { version });
  });
}
function setupPullAlias(program2) {
  program2.command("pull", { hidden: true }).description("Pull files from a Websim project to current directory").argument(
    "[project-id]",
    "Websim project ID (optional if .websim.json exists)"
  ).argument(
    "[version]",
    "Revision version number to pull (uses latest if not specified)",
    parseInt
  ).action((projectId, version) => {
    handlePull(projectId, { version });
  });
}
function setupProjectsCloneCommand(program2) {
  program2.command("clone").description(
    "Clone a Websim project into a new directory named after the project in current directory"
  ).argument("<project-id>", "Websim project ID").argument(
    "[version]",
    "Revision version number to clone (uses latest if not specified)",
    parseInt
  ).action((projectId, version) => {
    handleClone(projectId, { version });
  });
}
function setupCloneAlias(program2) {
  program2.command("clone", { hidden: true }).description(
    "Clone a Websim project into a new directory named after the project in current directory"
  ).argument("<project-id>", "Websim project ID").argument(
    "[version]",
    "Revision version number to clone (uses latest if not specified)",
    parseInt
  ).action((projectId, version) => {
    handleClone(projectId, { version });
  });
}
async function handleSync(projectId, parentVersion, options = {}) {
  const directoryPath = process.cwd();
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    if (!projectId) {
      projectId = client.readWebsimConfig(directoryPath) ?? void 0;
      if (!projectId) {
        throw new Error(
          "No project ID provided and no .websim.json found in current directory"
        );
      }
      console.log(`Using project ID from .websim.json: ${projectId}`);
    }
    try {
      let version = parentVersion;
      if (!version) {
        const baseVersion = client.readWebsimConfigData(directoryPath)?.baseVersion;
        if (baseVersion) {
          console.log(
            `Creating new revision based on local base version ${baseVersion}`
          );
          version = baseVersion;
        } else {
          console.log(
            `No local base version recorded; creating new revision based on latest version`
          );
          version = await client.getLatestRevisionVersion(projectId);
        }
      } else {
        console.log(`Creating new revision based on version ${version}`);
      }
      const revisionResponse = await client.createProjectRevision(
        projectId,
        version
      );
      const newVersion = revisionResponse.project_revision.version;
      console.log(`Created revision ${newVersion}`);
      await createRevisionSite(
        client,
        revisionResponse.project_revision,
        options.message
      );
      console.log(`Syncing files to revision ${newVersion}`);
      const result = await client.syncDirectoryToRevision(
        projectId,
        newVersion,
        directoryPath
      );
      console.log(`Successfully synced assets`);
      client.writeWebsimConfig(directoryPath, projectId, newVersion);
      if (options.promote !== false) {
        await client.setProjectCurrentVersion(projectId, newVersion);
        console.log(`Promoted revision ${newVersion} to current (live)`);
      } else {
        console.log(
          `Revision ${newVersion} finalized but NOT promoted (live site unchanged)`
        );
      }
      const url = `${CLI_CONFIG.webBaseUrl}/p/${projectId}/${newVersion}`;
      console.log(`New revision created: ${url}`);
      if (options.open !== false) {
        open_default(url);
      }
      return result;
    } catch (error) {
      if (error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handleSync(projectId, parentVersion, options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
async function handlePull(projectId, options) {
  const directoryPath = process.cwd();
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    if (!projectId) {
      projectId = client.readWebsimConfig(directoryPath) ?? void 0;
      if (!projectId) {
        throw new Error(
          "No project ID provided and no .websim.json found in current directory"
        );
      }
      console.log(`Using project ID from .websim.json: ${projectId}`);
    }
    console.log(`Pulling files from project ${projectId} to ${directoryPath}`);
    try {
      const revisionVersion = options.version || await client.getLatestRevisionVersion(projectId);
      console.log(`Pulling files from revision ${revisionVersion}`);
      const result = await client.pullRevisionToDirectory(
        projectId,
        revisionVersion,
        directoryPath
      );
      if (result.success) {
        console.log(
          `Successfully pulled assets from revision: ${revisionVersion}`
        );
      } else {
        console.log(
          `Partially pulled assets from revision: ${revisionVersion} (some files failed)`
        );
        console.log(
          `You may want to try again or check for specific file issues`
        );
      }
      console.log(
        `URL: ${CLI_CONFIG.webBaseUrl}/p/${projectId}/${revisionVersion}`
      );
      return result;
    } catch (error) {
      if ("status" in error && error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handlePull(projectId, options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
async function handleClone(projectId, options) {
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    try {
      const project = await client.getProject(projectId);
      const revisionVersion = options.version || project.project_revision?.version;
      console.log(
        `Using ${options.version ? "specified" : "latest"} version: ${revisionVersion}`
      );
      const projectName = (project.project.title ?? `project-${projectId}`).replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-");
      console.log(`Project name: ${projectName}`);
      const projectDirPath = path5.join(process.cwd(), projectName);
      console.log(`Cloning project to: ${projectDirPath}`);
      const result = await client.pullRevisionToDirectory(
        projectId,
        revisionVersion ?? 0,
        projectDirPath,
        true
        // isClone = true to write .websim.json
      );
      if (result.success) {
        console.log(`Successfully cloned project to ${projectDirPath}`);
      } else {
        console.log(
          `Partially cloned project to ${projectDirPath} (some files failed)`
        );
        console.log(
          `You may want to try again or check for specific file issues`
        );
      }
      console.log(
        `URL: ${CLI_CONFIG.webBaseUrl}/p/${projectId}/${revisionVersion}`
      );
      return result;
    } catch (error) {
      if ("status" in error && error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handleClone(projectId, options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
function setupProjectsGetCommand(program2) {
  program2.command("get").description("Get project information by ID").argument(
    "[project-id]",
    "Websim project ID (optional if .websim.json exists)"
  ).option(
    "--include <items>",
    "Comma-separated list of items to include (members,permissions,chat_threads,chat_thread_viewers)"
  ).option("--json", "Output raw JSON").action((projectId, options) => {
    handleProjectsGet(projectId, options);
  });
}
function setupProjectsGetLineageCommand(program2) {
  program2.command("get-lineage").description("Get the lineage of a project by recursively following parent_id").argument(
    "[project-id]",
    "Websim project ID (optional if .websim.json exists)"
  ).option("--json", "Output raw JSON").option("--reverse", "Show lineage from oldest to newest (default: newest to oldest)").action((projectId, options) => {
    handleProjectsGetLineage(projectId, options);
  });
}
function setupProjectsListCommand(program2) {
  program2.command("list").description("List projects for a user (username or UUID)").argument("[user]", "Username or user ID").option("--first <n>", "Get first N projects", parseInt).option("--last <n>", "Get last N projects", parseInt).option("--before <cursor>", "Cursor: before").option("--after <cursor>", "Cursor: after").option("--json", "Output raw JSON").action((user, options) => {
    handleListUserProjects(user, options);
  });
}
function setupProjectsListCurrentCommand(program2) {
  program2.command("list-current").description("List projects for the current authenticated user").option("--first <n>", "Get first N projects", parseInt).option("--last <n>", "Get last N projects", parseInt).option("--before <cursor>", "Cursor: before").option("--after <cursor>", "Cursor: after").option("--json", "Output raw JSON").action((options) => {
    handleListCurrentUserProjects(options);
  });
}
function setupProjectsRevisionsCommand(program2) {
  program2.command("revisions").description("Get paginated list of revisions for a project").argument(
    "[project-id]",
    "Websim project ID (optional if .websim.json exists)"
  ).option("--first <count>", "Get first N revisions", parseInt).option("--last <count>", "Get last N revisions", parseInt).option("--before <cursor>", "Get revisions before this cursor").option("--after <cursor>", "Get revisions after this cursor").option("--json", "Output raw JSON").action((projectId, options) => {
    handleProjectsRevisions(projectId, options);
  });
}
async function handleProjectsGet(projectId, options) {
  const directoryPath = process.cwd();
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    if (!projectId) {
      projectId = client.readWebsimConfig(directoryPath) ?? void 0;
      if (!projectId) {
        throw new Error(
          "No project ID provided and no .websim.json found in current directory"
        );
      }
      console.log(`Using project ID from .websim.json: ${projectId}`);
    }
    try {
      const query = {};
      if (options.include) {
        query.include = options.include.split(",").map((s) => s.trim());
      }
      const result = await client.getProject(projectId, query);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printProjectDetails(result);
      }
      return result;
    } catch (error) {
      if (error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handleProjectsGet(projectId, options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
async function handleProjectsGetLineage(projectId, options) {
  const directoryPath = process.cwd();
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    if (!projectId) {
      projectId = client.readWebsimConfig(directoryPath) ?? void 0;
      if (!projectId) {
        throw new Error(
          "No project ID provided and no .websim.json found in current directory"
        );
      }
      console.log(`Using project ID from .websim.json: ${projectId}`);
    }
    try {
      const lineage = await client.getProjectLineage(projectId);
      const displayLineage = options.reverse ? lineage.reverse() : lineage;
      if (options.json) {
        console.log(JSON.stringify(displayLineage, null, 2));
      } else {
        printProjectLineage(displayLineage);
      }
      return displayLineage;
    } catch (error) {
      if (error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handleProjectsGetLineage(projectId, options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
async function handleListUserProjects(user, options) {
  try {
    if (!user) {
      return handleListCurrentUserProjects(options);
    }
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    const params = buildProjectCollectionParams(options);
    try {
      const result = await client.getUserProjects(user, params);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printProjectListCollection(result);
      }
      return result;
    } catch (error) {
      if (error && error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handleListUserProjects(user, options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
async function handleListCurrentUserProjects(options) {
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    const params = buildProjectCollectionParams(options);
    try {
      const result = await client.getCurrentUserProjects(params);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printProjectListCollection(result);
      }
      return result;
    } catch (error) {
      if (error && error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handleListCurrentUserProjects(options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
function buildProjectCollectionParams(options) {
  const params = {};
  if (options.first !== void 0)
    params.first = options.first;
  if (options.last !== void 0)
    params.last = options.last;
  if (options.before !== void 0)
    params.before = options.before;
  if (options.after !== void 0)
    params.after = options.after;
  return params;
}
async function handleProjectsRevisions(projectId, options) {
  const directoryPath = process.cwd();
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    if (!projectId) {
      projectId = client.readWebsimConfig(directoryPath) ?? void 0;
      if (!projectId) {
        throw new Error(
          "No project ID provided and no .websim.json found in current directory"
        );
      }
      console.log(`Using project ID from .websim.json: ${projectId}`);
    }
    try {
      const result = await client.getProjectRevisions({
        projectId,
        first: options.first,
        last: options.last,
        before: options.before,
        after: options.after
      });
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printProjectRevisions(result);
      }
      return result;
    } catch (error) {
      if (error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handleProjectsRevisions(projectId, options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
function printProjectCreateResult(result) {
  const { project, project_revision, site } = result;
  console.log(`Project created successfully!`);
  console.log(`  Project ID: ${project.id}`);
  console.log(`  Title: ${project.title ?? "(untitled)"}`);
  console.log(`  Visibility: ${project.visibility ?? "public"}`);
  console.log(`  Created: ${new Date(project.created_at).toLocaleString()}`);
  if (project_revision) {
    console.log(`  Initial Revision: v${project_revision.version}`);
    console.log(`  Revision ID: ${project_revision.id}`);
    console.log(`  Draft: ${project_revision.draft ? "Yes" : "No"}`);
  }
  if (site) {
    console.log(`  Site ID: ${site.id}`);
    console.log(`  Site URL: ${site.link_url}`);
  }
  if (project.parent_id) {
    console.log(`  Forked from: ${project.parent_id}`);
  }
  console.log(`
Project URL: ${CLI_CONFIG.webBaseUrl}/p/${project.id}${project_revision ? `/${project_revision.version}` : ""}`);
}
function printProjectLineage(lineage) {
  if (lineage.length === 0) {
    console.log("No lineage found for the given project.");
    return;
  }
  console.log(`Project Lineage (${lineage.length} generation${lineage.length > 1 ? "s" : ""}):
`);
  lineage.forEach((item, index) => {
    const { project, project_revision } = item;
    const depth = index;
    const indent = "  ".repeat(depth);
    const arrow = depth > 0 ? "\u2514\u2500 " : "";
    console.log(`${indent}${arrow}[${index + 1}] Project: ${project.id}`);
    console.log(`${indent}    Title: ${project.title ?? "(untitled)"}`);
    console.log(`${indent}    Created: ${new Date(project.created_at).toLocaleString()}`);
    if (project_revision) {
      console.log(`${indent}    Revision: v${project_revision.version}`);
    }
    if (project.parent_id) {
      console.log(`${indent}    Parent: ${project.parent_id}`);
    } else {
      console.log(`${indent}    Parent: (none - root project)`);
    }
    if (index < lineage.length - 1) {
      console.log("");
    }
  });
}
function printProjectDetails(result) {
  const { project, project_revision, site, included } = result;
  console.log(`Project: ${project.id}`);
  console.log(`  Title: ${project.title ?? "(untitled)"}`);
  console.log(`  Description: ${project.description ?? "(no description)"}`);
  console.log(`  Created: ${new Date(project.created_at).toLocaleString()}`);
  console.log(`  Updated: ${new Date(project.updated_at).toLocaleString()}`);
  console.log(`  Likes: ${project.likes_count ?? 0}`);
  console.log(`  Views: ${project.views_count ?? 0}`);
  if (project_revision) {
    console.log(`
Latest Revision: v${project_revision.version}`);
    console.log(`  Created: ${new Date(project_revision.created_at).toLocaleString()}`);
    console.log(`  Draft: ${project_revision.draft ? "Yes" : "No"}`);
    if (project_revision.site_id) {
      console.log(`  Site ID: ${project_revision.site_id}`);
    }
  }
  if (site) {
    console.log(`
Site: ${site.id}`);
    console.log(`  Title: ${site.title ?? "(untitled)"}`);
    console.log(`  State: ${site.state}`);
    console.log(`  URL: ${site.link_url}`);
  }
  if (included && included.length > 0) {
    console.log(`
Included Data (${included.length} items):`);
    const groupedByType = included.reduce((acc, item) => {
      const type = item._type || "unknown";
      if (!acc[type])
        acc[type] = [];
      acc[type].push(item);
      return acc;
    }, {});
    for (const [type, items] of Object.entries(groupedByType)) {
      console.log(`  ${type}: ${items.length} item(s)`);
    }
  }
}
function printProjectListCollection(collection) {
  if (!collection.data.length) {
    console.log("No projects found.");
    return;
  }
  for (const item of collection.data) {
    const { project, project_revision } = item;
    const revStr = project_revision ? `v${project_revision.version}` : "-";
    console.log(
      `${project.id}  ${revStr.padEnd(8)}  ${project.title ?? "(untitled)"}`
    );
    console.log(`  Created: ${new Date(project.created_at).toLocaleString()}`);
    console.log("");
  }
  console.log(`Pagination:`);
  console.log(`  Start cursor: ${collection.meta.start_cursor || "null"}`);
  console.log(`  End cursor: ${collection.meta.end_cursor || "null"}`);
  if (collection.meta.has_next_page) {
    console.log(`  Next page: --after ${collection.meta.end_cursor}`);
  }
  if (collection.meta.has_previous_page) {
    console.log(`  Previous page: --before ${collection.meta.start_cursor}`);
  }
}
function printProjectRevisions(result) {
  if (!result?.data || result.data.length === 0) {
    console.log("No revisions found.");
    return;
  }
  console.log(`Revisions (${result.data.length} shown, newest first):
`);
  for (const item of result.data) {
    const revision = item.project_revision;
    const isDraft = revision.draft ? " [DRAFT]" : "";
    console.log(`v${revision.version}${isDraft}`);
    console.log(`  ID: ${revision.id}`);
    console.log(`  Created: ${new Date(revision.created_at).toLocaleString()}`);
    if (revision.site_id) {
      console.log(`  Site: ${revision.site_id}`);
    }
    if (revision.parent_revision_version !== null) {
      console.log(`  Parent: v${revision.parent_revision_version}`);
    }
    console.log("");
  }
  const meta = result.meta;
  if (meta) {
    if (meta.has_next_page) {
      console.log("More revisions available (use --after cursor)");
    }
    if (meta.has_previous_page) {
      console.log("Previous revisions available (use --before cursor)");
    }
  }
}
async function handleProjectsCreate(options) {
  const directoryPath = process.cwd();
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    try {
      const createBody = {};
      if (options.parentProject) {
        if (!options.parentVersion) {
          throw new Error("--parent-version is required when --parent-project is specified");
        }
        createBody.parent = {
          project_id: options.parentProject,
          version: options.parentVersion
        };
      }
      if (options.visibility) {
        createBody.visibility = options.visibility;
      }
      if (options.template) {
        createBody.asTemplate = true;
      }
      if (options.mainProject) {
        createBody.main_project_id = options.mainProject;
      }
      console.log("Creating project...");
      const result = await client.createProject(createBody);
      await ensureRevisionHasSite(client, result.project_revision);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printProjectCreateResult(result);
        client.writeWebsimConfig(directoryPath, result.project.id);
        console.log(`
Project configuration saved to .websim.json`);
      }
      return result;
    } catch (error) {
      if (error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handleProjectsCreate(options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
async function handlePush(projectId, options) {
  const directoryPath = process.cwd();
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    if (!projectId) {
      projectId = client.readWebsimConfig(directoryPath) ?? void 0;
      if (!projectId) {
        throw new Error(
          "No project ID provided and no .websim.json found in current directory"
        );
      }
      console.log(`Using project ID from .websim.json: ${projectId}`);
    }
    try {
      const revisionVersion = options.version || client.readWebsimConfigData(directoryPath)?.baseVersion || await client.getLatestRevisionVersion(projectId);
      console.log(`Pushing files to existing revision ${revisionVersion}`);
      const result = await client.syncDirectoryToRevision(
        projectId,
        revisionVersion,
        directoryPath
      );
      console.log(`Successfully pushed assets to revision ${revisionVersion}`);
      return result;
    } catch (error) {
      if (error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handlePush(projectId, options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}

// experimental/websim-cli/src/constants/abilities.ts
var ABILITY_FLAGS = [
  { name: "websim/tweaks", option: "enableTweaks", description: "Enable websim/tweaks package" },
  { name: "websim/multiplayer", option: "enableMultiplayer", description: "Enable websim/multiplayer package" },
  { name: "websim/database", option: "enableDatabase", description: "Enable websim/database package" },
  { name: "websim/ai-inference", option: "enableAiInference", description: "Enable websim/ai-inference package" },
  { name: "websim/comments", option: "enableComments", description: "Enable websim/comments package" },
  { name: "websim/video", option: "enableVideo", description: "Enable websim/video package" }
];
function buildAbilities(options) {
  const abilities = {};
  for (const flag of ABILITY_FLAGS) {
    const value = options[flag.option];
    if (value !== void 0) {
      abilities[flag.name] = value;
    }
  }
  return Object.keys(abilities).length > 0 ? abilities : void 0;
}

// experimental/websim-cli/src/commands/prompt.ts
function setupPromptCommand(program2) {
  program2.command("prompt").description("Create a new site by prompting with AI (handles project/revision creation automatically)").argument("<prompt...>", "The prompt text to generate the site").option("--project-id <id>", "Existing project ID (creates new project if not specified)").option("--model <name>", "AI model to use (default: gpt-5-mini)").option("--temperature <value>", "Temperature for AI generation (0-1)", parseFloat).option("--system-prompt <text>", "System prompt for AI generation").option("--visibility <visibility>", "Project visibility for new projects (public|private|unlisted)", "public").option("--branch", "Always create a new branch even if you own the project").option("--main-project-id <id>", "Main project ID for branching").option("--enable-tweaks", "Enable websim/tweaks package").option("--enable-multiplayer", "Enable websim/multiplayer package").option("--enable-database", "Enable websim/database package").option("--enable-ai-inference", "Enable websim/ai-inference package").option("--enable-comments", "Enable websim/comments package").option("--enable-video", "Enable websim/video package").option("--json", "Output raw JSON response").action((promptWords, options) => {
    const prompt = promptWords.join(" ");
    handlePrompt(prompt, options);
  });
}
async function handlePrompt(promptText, options) {
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    try {
      const { project, project_revision } = await getNextRevision(client, options);
      const siteBody = {
        project_id: project.id,
        project_version: project_revision.version,
        project_revision_id: project_revision.id,
        generate: {
          prompt: {
            type: "plaintext",
            data: null,
            text: promptText
          },
          flags: {
            enable_agent_models: false,
            verbose_mode: false
          },
          model: options.model || "gpt-5-mini"
        }
      };
      const abilities = buildAbilities(options);
      if (abilities) {
        siteBody.abilities = abilities;
      }
      if (options.temperature !== void 0) {
        siteBody.generate.temperature = options.temperature;
      }
      if (options.systemPrompt) {
        siteBody.generate.systemPrompt = options.systemPrompt;
      }
      if (options.mainProjectId) {
        siteBody.generate.main_project_id = options.mainProjectId;
      }
      const siteResult = await client.createSite(siteBody);
      await client.finalizeRevision(project.id, project_revision.version);
      const output = {
        project_id: project.id,
        project_version: project_revision.version,
        project_revision_id: project_revision.id,
        site_id: siteResult.site.id,
        url: siteResult.site.link_url
      };
      if (options.json) {
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.log(`\u2705 Site created successfully!
`);
        console.log(`Project ID:      ${output.project_id}`);
        console.log(`Project Version: ${output.project_version}`);
        console.log(`Revision ID:     ${output.project_revision_id}`);
        console.log(`Site ID:         ${output.site_id}`);
        console.log(`URL:             ${output.url}`);
        if (siteResult.site.state === "generating") {
          console.log(`
\u26A0\uFE0F  Site is currently generating. It may take a moment to complete.`);
        }
      }
      return output;
    } catch (error) {
      if (error && error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handlePrompt(promptText, options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
async function getNextRevision(client, options) {
  let project = null;
  let project_revision = null;
  if (options.projectId) {
    const projectData = await client.getProject(options.projectId, { include: ["permissions"] });
    project = projectData.project;
    const currentRevision = projectData.project_revision;
    const permissions = projectData.included?.find((item) => item._type === "project_permissions");
    const userOwnsProject = permissions && "can_edit" in permissions && permissions.can_edit === true;
    if (!currentRevision) {
      const revisionData = await client.createProjectRevision(project.id);
      project = revisionData.project;
      project_revision = revisionData.project_revision;
    } else if (options.branch || !userOwnsProject) {
      const branchData = await client.createProject({
        parent: {
          project_id: project.id,
          version: currentRevision.version
        },
        visibility: options.visibility,
        main_project_id: options.mainProjectId
      });
      project = branchData.project;
      project_revision = branchData.project_revision;
    } else if (!currentRevision.draft) {
      const revisionData = await client.createProjectRevision(
        project.id,
        currentRevision.version
      );
      project = revisionData.project;
      project_revision = revisionData.project_revision;
    } else {
      project_revision = currentRevision;
    }
  } else {
    const projectData = await client.createProject({
      visibility: options.visibility,
      main_project_id: options.mainProjectId
    });
    project = projectData.project;
    project_revision = projectData.project_revision;
  }
  return { project, project_revision };
}

// experimental/websim-cli/src/commands/sites.ts
function setupSiteCommands(program2) {
  const sites = program2.command("sites").description("Site-related commands");
  setupCreateSiteCommand(sites);
  setupGetSiteCommand(sites);
  setupGetSiteLineageCommand(sites);
  setupListUserSitesCommand(sites);
  setupListCurrentUserSitesCommand(sites);
}
function setupCreateSiteCommand(program2) {
  program2.command("create").description("Create a new site").requiredOption("--project-id <id>", "Project ID").requiredOption("--project-version <version>", "Project version").requiredOption("--project-revision-id <id>", "Project revision ID").option("--content <html>", "HTML content for the site").option("--generate", "Generate site content using AI").option("--model <name>", "AI model to use for generation (default: gemini-flash)").option("--temperature <value>", "Temperature for AI generation").option("--system-prompt <text>", "System prompt for AI generation").option("--prompt-text <text>", "User prompt text for AI generation (required with --generate)").option("--set-current", "Set as current site").option("--disable-auto-set-current", "Disable auto-set current").option("--main-project-id <id>", "Main project ID").option("--enable-tweaks", "Enable websim/tweaks package").option("--enable-multiplayer", "Enable websim/multiplayer package").option("--enable-database", "Enable websim/database package").option("--enable-ai-inference", "Enable websim/ai-inference package").option("--enable-comments", "Enable websim/comments package").option("--enable-video", "Enable websim/video package").option("--json", "Output raw JSON").action((options) => {
    handleCreateSite(options);
  });
}
function setupGetSiteCommand(program2) {
  program2.command("get").description("Get site details by ID").argument("<site-id>", "Site ID").option("--json", "Output raw JSON").action((siteId, options) => {
    handleGetSite(siteId, options);
  });
}
function setupGetSiteLineageCommand(program2) {
  program2.command("get-lineage").description("Get the lineage of a site by recursively following parent_id").argument("<site-id>", "Site ID").option("--json", "Output raw JSON").option("--reverse", "Show lineage from oldest to newest (default: newest to oldest)").action((siteId, options) => {
    handleGetSiteLineage(siteId, options);
  });
}
function setupListUserSitesCommand(program2) {
  program2.command("list").description("List sites for a user (username or UUID)").argument("[user]", "Username or user ID").option("--first <n>", "Get first N sites", parseInt).option("--last <n>", "Get last N sites", parseInt).option("--before <cursor>", "Cursor: before").option("--after <cursor>", "Cursor: after").option(
    "--state <states>",
    "Comma-separated site states (initial,generating,done,failed)"
  ).option("--json", "Output raw JSON").action((user, options) => {
    handleListUserSites(user, options);
  });
}
function setupListCurrentUserSitesCommand(program2) {
  program2.command("list-current").description("List sites for the current authenticated user").option("--first <n>", "Get first N sites", parseInt).option("--last <n>", "Get last N sites", parseInt).option("--before <cursor>", "Cursor: before").option("--after <cursor>", "Cursor: after").option(
    "--state <states>",
    "Comma-separated site states (initial,generating,done,failed)"
  ).option("--json", "Output raw JSON").action((options) => {
    handleListCurrentUserSites(options);
  });
}
async function handleCreateSite(options) {
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    try {
      const body = {
        project_id: options.projectId,
        project_version: options.projectVersion,
        project_revision_id: options.projectRevisionId
      };
      if (options.content) {
        body.content = options.content;
      }
      const abilities = buildAbilities(options);
      if (abilities) {
        body.abilities = abilities;
      }
      if (options.generate) {
        if (!options.promptText) {
          throw new Error("--prompt-text is required when using --generate");
        }
        body.generate = {
          prompt: {
            type: "plaintext",
            data: null,
            text: options.promptText
          },
          flags: {
            enable_agent_models: false,
            verbose_mode: false
          },
          model: "gemini-flash"
        };
        if (options.model)
          body.generate.model = options.model;
        if (options.temperature !== void 0)
          body.generate.temperature = options.temperature;
        if (options.systemPrompt)
          body.generate.systemPrompt = options.systemPrompt;
        if (options.setCurrent)
          body.generate.set_current = options.setCurrent;
        if (options.disableAutoSetCurrent)
          body.generate.disable_auto_set_current = options.disableAutoSetCurrent;
        if (options.mainProjectId)
          body.generate.main_project_id = options.mainProjectId;
      }
      const result = await client.createSite(body);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printSiteCreateResult(result);
      }
      return result;
    } catch (error) {
      if (error && error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handleCreateSite(options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
async function handleGetSite(siteId, options) {
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    try {
      const result = await client.getSite(siteId);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printSiteDetails(result);
      }
      return result;
    } catch (error) {
      if (error && error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handleGetSite(siteId, options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
async function handleGetSiteLineage(siteId, options) {
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    try {
      const lineage = await client.getSiteLineage(siteId);
      const displayLineage = options.reverse ? lineage.reverse() : lineage;
      if (options.json) {
        console.log(JSON.stringify(displayLineage, null, 2));
      } else {
        printSiteLineage(displayLineage);
      }
      return displayLineage;
    } catch (error) {
      if (error && error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handleGetSiteLineage(siteId, options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
async function handleListUserSites(user, options) {
  try {
    if (!user) {
      return handleListCurrentUserSites(options);
    }
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    const params = buildSiteCollectionParams(options);
    try {
      const result = await client.getUserSites(user, params);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printSiteCollection(result);
      }
      return result;
    } catch (error) {
      if (error && error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handleListUserSites(user, options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
async function handleListCurrentUserSites(options) {
  try {
    let authToken = await getAuthToken();
    const client = new WebsimApiClient({
      baseUrl: CLI_CONFIG.auth.baseUrl + "/api/v1",
      authToken
    });
    const params = buildSiteCollectionParams(options);
    try {
      const result = await client.getCurrentUserSites(params);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printSiteCollection(result);
      }
      return result;
    } catch (error) {
      if (error && error.status === 401) {
        authToken = await handleAuthError();
        client.setAuthToken(authToken);
        return handleListCurrentUserSites(options);
      }
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}
function buildSiteCollectionParams(options) {
  const params = {};
  if (options.first !== void 0)
    params.first = options.first;
  if (options.last !== void 0)
    params.last = options.last;
  if (options.before !== void 0)
    params.before = options.before;
  if (options.after !== void 0)
    params.after = options.after;
  if (options.state) {
    params.state = options.state.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return params;
}
function printSiteCreateResult(result) {
  const { site, project, project_revision } = result;
  console.log(`\u2705 Site created successfully!`);
  console.log(`
Site Details:`);
  console.log(`  ID:    ${site.id}`);
  console.log(`  Title: ${site.title ?? "(untitled)"}`);
  console.log(`  State: ${site.state}`);
  console.log(`  URL:   ${site.link_url}`);
  if (project) {
    console.log(`
Project Details:`);
    console.log(`  ID:    ${project.id}`);
    console.log(`  Title: ${project.title ?? "(untitled)"}`);
  }
  if (project_revision) {
    console.log(`
Revision Details:`);
    console.log(`  Version: ${project_revision.version}`);
    console.log(`  ID:      ${project_revision.id}`);
  }
  if (site.state === "generating") {
    console.log(`
\u26A0\uFE0F  Site is currently generating. Use 'websim-cli sites get ${site.id}' to check status.`);
  }
}
function printSiteDetails(result) {
  const { site, project, project_revision } = result;
  console.log(`Site: ${site.id}`);
  console.log(`  Title: ${site.title ?? "(untitled)"}`);
  console.log(`  State: ${site.state}`);
  console.log(`  URL:   ${site.link_url}`);
  if (project) {
    console.log(`Project: ${project.id} (${project.title ?? "(untitled)"})`);
  }
  if (project_revision) {
    console.log(
      `Revision: ${project_revision.version} (${project_revision.id})`
    );
  }
}
function printSiteLineage(lineage) {
  if (lineage.length === 0) {
    console.log("No lineage found for the given site.");
    return;
  }
  console.log(`Site Lineage (${lineage.length} generation${lineage.length > 1 ? "s" : ""}):
`);
  lineage.forEach((item, index) => {
    const { site, project, project_revision } = item;
    const depth = index;
    const indent = "  ".repeat(depth);
    const arrow = depth > 0 ? "\u2514\u2500 " : "";
    console.log(`${indent}${arrow}[${index + 1}] Site: ${site.id}`);
    console.log(`${indent}    Title: ${site.title ?? "(untitled)"}`);
    console.log(`${indent}    State: ${site.state}`);
    console.log(`${indent}    Created: ${new Date(site.created_at).toLocaleString()}`);
    console.log(`${indent}    URL: ${site.link_url}`);
    if (project) {
      console.log(`${indent}    Project: ${project.id} (${project.title ?? "(untitled)"})`);
    }
    if (project_revision) {
      console.log(`${indent}    Revision: v${project_revision.version}`);
    }
    if (site.parent_id) {
      console.log(`${indent}    Parent: ${site.parent_id}`);
    } else {
      console.log(`${indent}    Parent: (none - root site)`);
    }
    if (index < lineage.length - 1) {
      console.log("");
    }
  });
}
function printSiteCollection(collection) {
  if (!collection.data.length) {
    console.log("No sites found.");
    return;
  }
  for (const item of collection.data) {
    const { site, project, project_revision } = item;
    const projectStr = project ? `${project.id}${project.title ? ` (${project.title})` : ""}` : "-";
    const revStr = project_revision ? `${project_revision.version}` : "-";
    console.log(
      `${site.id}  ${site.state.padEnd(10)}  ${revStr.padEnd(4)}  ${site.title ?? "(untitled)"}
  ${site.link_url}${projectStr ? `
  Project: ${projectStr}` : ""}`
    );
    console.log("");
  }
  console.log(`Pagination:`);
  console.log(`  Start cursor: ${collection.meta.start_cursor || "null"}`);
  console.log(`  End cursor: ${collection.meta.end_cursor || "null"}`);
  if (collection.meta.has_next_page) {
    console.log(`  Next page: --after ${collection.meta.end_cursor}`);
  }
  if (collection.meta.has_previous_page) {
    console.log(`  Previous page: --before ${collection.meta.start_cursor}`);
  }
}

// experimental/websim-cli/src/index.ts
async function main() {
  const program2 = new Command();
  program2.name(CLI_CONFIG.name).version(CLI_CONFIG.version);
  setupAuthCommands(program2);
  setupDevCommand(program2);
  setupExperimentCommands(program2);
  setupModelsCommands(program2);
  setupProjectCommands(program2);
  setupPromptCommand(program2);
  setupSiteCommands(program2);
  program2.parse();
}
main().catch((err2) => {
  handleError(err2);
});
