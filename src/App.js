import React, {useState, useRef, useCallback, useMemo, useEffect, memo} from "react";
import { FileJson, GitCompare, AlertCircle, CheckCircle, Copy, RotateCcw, Upload, ArrowLeftRight, Search, Filter, Minimize2, Maximize2, Check, ChevronRight, ChevronDown, Pin, X, Eye,} from "lucide-react";

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const searchInObject = (
  obj,
  searchTerm,
  currentPath = "",
  parentPaths = []
) => {
  const matches = [];
  const lowerSearchTerm = searchTerm.toLowerCase();

  const search = (value, path, parents) => {
    if (value === null || value === undefined) return;

    if (typeof value === "object" && !Array.isArray(value)) {
      Object.entries(value).forEach(([key, val]) => {
        const newPath = path ? `${path}.${key}` : key;
        const newParents = [...parents, path].filter(Boolean);

        if (key.toLowerCase().includes(lowerSearchTerm)) {
          matches.push({ path: newPath, parents: newParents });
        }

        if (typeof val !== "object" && val !== null) {
          const valStr = String(val).toLowerCase();
          if (valStr.includes(lowerSearchTerm)) {
            matches.push({ path: newPath, parents: newParents });
          }
        }

        search(val, newPath, newParents);
      });
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const newPath = `${path}[${index}]`;
        const newParents = [...parents, path].filter(Boolean);

        if (typeof item !== "object" && item !== null) {
          const itemStr = String(item).toLowerCase();
          if (itemStr.includes(lowerSearchTerm)) {
            matches.push({ path: newPath, parents: newParents });
          }
        }

        search(item, newPath, newParents);
      });
    }
  };

  search(obj, currentPath, parentPaths);
  return matches;
};

const TreeNode = memo(
  ({
    nodeKey,
    value,
    path,
    differences,
    isLeft,
    level = 0,
    onHover,
    onPin,
    pinnedPath,
    searchMatches = [],
    searchTerm = "",
    currentMatchIndex = -1,
    expandedPaths = new Set(),
    selectedPath = "",
  }) => {
    const matchData = searchMatches.find((m) => m.path === path);
    const isMatchedPath = !!matchData;
    const isCurrentMatch = searchMatches[currentMatchIndex]?.path === path;
    const isSelected = selectedPath === path;
    const shouldExpand =
      expandedPaths.has(path) || isMatchedPath || isSelected || level < 2;
    const [isExpanded, setIsExpanded] = useState(shouldExpand);
    const nodeRef = useRef(null);

    const isPinned = pinnedPath === path;

    useEffect(() => {
      if (shouldExpand) {
        setIsExpanded(true);
      }
    }, [shouldExpand]);

    useEffect(() => {
      if ((isCurrentMatch || isSelected) && nodeRef.current) {
        setTimeout(() => {
          nodeRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        }, 200);
      }
    }, [isCurrentMatch, isSelected]);

    const getDiffStatus = useCallback(() => {
      if (!differences) return null;

      const diff = differences.find((d) => d.path === path);
      if (!diff) return null;

      if (diff.type === "added" && !isLeft) return "added";
      if (diff.type === "removed" && isLeft) return "removed";
      if (diff.type === "modified") return "modified";

      return null;
    }, [differences, path, isLeft]);

    const diffStatus = getDiffStatus();

    const isObject =
      value && typeof value === "object" && !Array.isArray(value);
    const isArray = Array.isArray(value);
    const isPrimitive = !isObject && !isArray;
    const hasChildren = isObject || isArray;

    const getBgColor = () => {
      if (isSelected) return "rgba(168, 85, 247, 0.3)";
      if (isCurrentMatch && searchTerm) return "rgba(251, 191, 36, 0.4)";
      if (isMatchedPath && searchTerm) return "rgba(251, 191, 36, 0.2)";
      if (isPinned) return "rgba(168, 85, 247, 0.15)";
      if (!diffStatus) return "transparent";
      if (diffStatus === "added") return "rgba(34, 197, 94, 0.1)";
      if (diffStatus === "removed") return "rgba(239, 68, 68, 0.1)";
      if (diffStatus === "modified") return "rgba(234, 179, 8, 0.1)";
      return "transparent";
    };

    const getTextColor = useCallback(() => {
      if (isSelected) return "text-purple-300 font-bold";
      if (isCurrentMatch && searchTerm) return "text-yellow-300 font-bold";
      if (isMatchedPath && searchTerm) return "text-yellow-300 font-bold";
      if (!diffStatus) return "";
      if (diffStatus === "added") return "text-green-300";
      if (diffStatus === "removed") return "text-red-300";
      if (diffStatus === "modified") return "text-yellow-300";
      return "";
    }, [isSelected, isCurrentMatch, searchTerm, isMatchedPath, diffStatus]);

    const highlightText = useCallback(
      (text) => {
        if (!searchTerm || !text) return text;

        const textStr = String(text);
        const lowerText = textStr.toLowerCase();
        const lowerSearch = searchTerm.toLowerCase();

        if (!lowerText.includes(lowerSearch)) return textStr;

        const parts = [];
        let lastIndex = 0;
        let index = lowerText.indexOf(lowerSearch);

        while (index !== -1) {
          if (index > lastIndex) {
            parts.push(textStr.substring(lastIndex, index));
          }
          parts.push(
            <mark
              key={index}
              className="bg-yellow-400 text-black px-0.5 rounded"
            >
              {textStr.substring(index, index + lowerSearch.length)}
            </mark>
          );
          lastIndex = index + lowerSearch.length;
          index = lowerText.indexOf(lowerSearch, lastIndex);
        }

        if (lastIndex < textStr.length) {
          parts.push(textStr.substring(lastIndex));
        }

        return parts;
      },
      [searchTerm]
    );

    const renderValue = useMemo(() => {
      const textColor = getTextColor();

      if (isPrimitive) {
        const valueStr = JSON.stringify(value);
        return (
          <span className={`text-emerald-400 ${textColor}`}>
            {highlightText(valueStr)}
          </span>
        );
      }

      if (isArray) {
        return (
          <span className="text-purple-400">
            [{isExpanded ? "" : `...${value.length} items`}]
          </span>
        );
      }

      return (
        <span className="text-purple-400">
          {"{"}
          {isExpanded ? "" : "..."}
          {"}"}
        </span>
      );
    }, [isPrimitive, isArray, isExpanded, value, highlightText, getTextColor]);

    const handleClick = useCallback(
      (e) => {
        e.stopPropagation();
        if (hasChildren) {
          setIsExpanded(!isExpanded);
        }
      },
      [hasChildren, isExpanded]
    );

    const handlePinClick = useCallback(
      (e) => {
        e.stopPropagation();
        onPin(path);
      },
      [onPin, path]
    );

    return (
      <div className="font-mono text-sm">
        <div
          ref={nodeRef}
          data-path={path}
          className={`flex items-center gap-1 py-1 px-2 hover:bg-slate-700/30 rounded cursor-pointer group transition-colors ${isPinned ? "ring-1 ring-purple-500/50" : ""
            } ${isSelected
              ? "ring-2 ring-purple-500"
              : isCurrentMatch && searchTerm
                ? "ring-2 ring-yellow-500"
                : isMatchedPath && searchTerm
                  ? "ring-1 ring-yellow-500/50"
                  : ""
            }`}
          style={{
            paddingLeft: `${level * 20 + 8}px`,
            backgroundColor: getBgColor(),
          }}
          onClick={handleClick}
          onMouseEnter={() => onHover(path)}
          onMouseLeave={() => !isPinned && onHover("")}
        >
          <span className="w-4 h-4 flex-shrink-0">
            {hasChildren &&
              (isExpanded ? (
                <ChevronDown className="w-4 h-4 text-purple-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-purple-400" />
              ))}
          </span>

          <span className={`text-blue-300 ${getTextColor()}`}>
            {highlightText(String(nodeKey))}:
          </span>

          <span className="ml-1">{renderValue}</span>

          {isCurrentMatch && searchTerm && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-bold bg-yellow-600 text-white animate-pulse">
              CURRENT
            </span>
          )}

          {isMatchedPath && !isCurrentMatch && searchTerm && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-bold bg-yellow-600/50 text-yellow-200">
              MATCH
            </span>
          )}

          {diffStatus && (
            <span
              className={`ml-2 px-1.5 py-0.5 rounded text-xs font-bold ${diffStatus === "added"
                  ? "bg-green-600/50 text-green-200"
                  : diffStatus === "removed"
                    ? "bg-red-600/50 text-red-200"
                    : "bg-yellow-600/50 text-yellow-200"
                }`}
            >
              {diffStatus.toUpperCase()}
            </span>
          )}

          <button
            onClick={handlePinClick}
            className={`ml-auto p-0.5 rounded transition-opacity ${isPinned
                ? "opacity-100 text-purple-400 hover:text-purple-300"
                : "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-purple-400"
              }`}
            title={isPinned ? "Unpin path" : "Pin path to copy"}
          >
            <Pin className="w-3 h-3" />
          </button>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {isObject &&
              Object.entries(value).map(([key, val]) => (
                <TreeNode
                  key={key}
                  nodeKey={key}
                  value={val}
                  path={path ? `${path}.${key}` : key}
                  differences={differences}
                  isLeft={isLeft}
                  level={level + 1}
                  onHover={onHover}
                  onPin={onPin}
                  pinnedPath={pinnedPath}
                  searchMatches={searchMatches}
                  searchTerm={searchTerm}
                  currentMatchIndex={currentMatchIndex}
                  expandedPaths={expandedPaths}
                  selectedPath={selectedPath}
                />
              ))}
            {isArray &&
              value.map((val, index) => (
                <TreeNode
                  key={index}
                  nodeKey={index}
                  value={val}
                  path={`${path}[${index}]`}
                  differences={differences}
                  isLeft={isLeft}
                  level={level + 1}
                  onHover={onHover}
                  onPin={onPin}
                  pinnedPath={pinnedPath}
                  searchMatches={searchMatches}
                  searchTerm={searchTerm}
                  currentMatchIndex={currentMatchIndex}
                  expandedPaths={expandedPaths}
                  selectedPath={selectedPath}
                />
              ))}
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.value === nextProps.value &&
      prevProps.path === nextProps.path &&
      prevProps.pinnedPath === nextProps.pinnedPath &&
      prevProps.searchTerm === nextProps.searchTerm &&
      prevProps.currentMatchIndex === nextProps.currentMatchIndex &&
      prevProps.selectedPath === nextProps.selectedPath &&
      prevProps.expandedPaths === nextProps.expandedPaths
    );
  }
);

TreeNode.displayName = "TreeNode";

const PathHeader = memo(({ path, side, onClearPath }) => {
  const [copied, setCopied] = useState(false);

  const copyPath = useCallback(() => {
    if (path) {
      navigator.clipboard.writeText(path).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [path]);

  return (
    <div
      className={`flex items-center gap-2 mb-3 pb-2 border-b ${side === "left" ? "border-purple-500/30" : "border-blue-500/30"
        }`}
    >
      <span
        className={`w-8 h-8 ${side === "left" ? "bg-purple-600" : "bg-blue-600"
          } rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0`}
      >
        {side === "left" ? "1" : "2"}
      </span>
      <div className="flex-1 min-w-0">
        <h4 className="text-lg font-semibold text-white">
          {side === "left" ? "First JSON" : "Second JSON"}
        </h4>
        {path ? (
          <div className="flex items-center gap-2 mt-1 bg-slate-900/50 rounded px-2 py-1">
            <Pin className="w-3 h-3 text-purple-400 flex-shrink-0" />
            <code className="text-xs text-purple-300 font-mono truncate block">
              {path}
            </code>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={copyPath}
                className={`p-1 rounded transition-colors ${copied
                    ? "bg-green-600/50 text-green-300"
                    : "bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white"
                  }`}
                title="Copy path to clipboard"
              >
                {copied ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={onClearPath}
                className="p-1 rounded bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white transition-colors"
                title="Clear path"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-2 mb-2 italic">
            Click the pin icon on any node to show its path
          </p>
        )}
      </div>
    </div>
  );
});

PathHeader.displayName = "PathHeader";

const JSONTree = memo(
  ({
    data,
    differences,
    isLeft,
    onPathHover,
    currentPath,
    onPathPin,
    pinnedPath,
    onClearPath,
    searchMatches,
    searchTerm,
    currentMatchIndex,
    expandedPaths,
    scrollRef,
    selectedPath,
  }) => {
    if (!data) {
      return (
        <div className="text-slate-500 italic p-4 text-center">
          No JSON data
        </div>
      );
    }

    return (
      <div className="h-full">
        <PathHeader
          path={pinnedPath || currentPath}
          side={isLeft ? "left" : "right"}
          onClearPath={onClearPath}
        />
        <div
          ref={scrollRef}
          className="max-h-[600px] overflow-auto bg-slate-900/70 rounded-lg p-2"
        >
          <div className="py-2">
            {typeof data === "object" &&
              Object.entries(data).map(([key, value]) => (
                <TreeNode
                  key={key}
                  nodeKey={key}
                  value={value}
                  path={key}
                  differences={differences}
                  isLeft={isLeft}
                  level={0}
                  onHover={onPathHover}
                  onPin={onPathPin}
                  pinnedPath={pinnedPath}
                  searchMatches={searchMatches}
                  searchTerm={searchTerm}
                  currentMatchIndex={currentMatchIndex}
                  expandedPaths={expandedPaths}
                  selectedPath={selectedPath}
                />
              ))}
          </div>
        </div>
      </div>
    );
  }
);

JSONTree.displayName = "JSONTree";

const sampleJSON1 = {
  name: "John Doe",
  age: 30,
  email: "john@example.com",
  address: {
    city: "New York",
    country: "USA",
    zipCode: "10001",
  },
  hobbies: ["reading", "gaming"],
};

const sampleJSON2 = {
  name: "John Doe",
  age: 31,
  email: "john.doe@example.com",
  address: {
    city: "Los Angeles",
    country: "USA",
    zipCode: "90001",
  },
  hobbies: ["reading", "coding", "gaming"],
};

const JSONCompare = () => {
  const [json1, setJson1] = useState("");
  const [json2, setJson2] = useState("");
  const [error1, setError1] = useState("");
  const [error2, setError2] = useState("");
  const [comparison, setComparison] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [fileName1, setFileName1] = useState("");
  const [fileName2, setFileName2] = useState("");
  const [dragOver1, setDragOver1] = useState(false);
  const [dragOver2, setDragOver2] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [isMinified1, setIsMinified1] = useState(false);
  const [isMinified2, setIsMinified2] = useState(false);
  const [copied, setCopied] = useState("");
  const [parsedJson1, setParsedJson1] = useState(null);
  const [parsedJson2, setParsedJson2] = useState(null);
  const [hoveredPath1, setHoveredPath1] = useState("");
  const [hoveredPath2, setHoveredPath2] = useState("");
  const [pinnedPath1, setPinnedPath1] = useState("");
  const [pinnedPath2, setPinnedPath2] = useState("");
  const [searchTerm1, setSearchTerm1] = useState("");
  const [searchTerm2, setSearchTerm2] = useState("");
  const [currentMatchIndex1, setCurrentMatchIndex1] = useState(-1);
  const [currentMatchIndex2, setCurrentMatchIndex2] = useState(-1);
  const [selectedDiffPath, setSelectedDiffPath] = useState("");

  const scrollRef1 = useRef(null);
  const scrollRef2 = useRef(null);
  const fileInput1Ref = useRef(null);
  const fileInput2Ref = useRef(null);

  const debouncedSearchTerm1 = useDebounce(searchTerm1, 500);
  const debouncedSearchTerm2 = useDebounce(searchTerm2, 500);

  const searchMatches1 = useMemo(() => {
    if (!debouncedSearchTerm1 || !parsedJson1) return [];
    return searchInObject(parsedJson1, debouncedSearchTerm1);
  }, [debouncedSearchTerm1, parsedJson1]);

  const searchMatches2 = useMemo(() => {
    if (!debouncedSearchTerm2 || !parsedJson2) return [];
    return searchInObject(parsedJson2, debouncedSearchTerm2);
  }, [debouncedSearchTerm2, parsedJson2]);

  const expandedPaths1 = useMemo(() => {
    const paths = new Set();
    searchMatches1.forEach((match) => {
      match.parents.forEach((parent) => paths.add(parent));
      paths.add(match.path);
    });
    if (selectedDiffPath) {
      let currentPath = "";
      const pathParts = selectedDiffPath.split(/\.|\[/).filter(Boolean);

      pathParts.forEach((part, index) => {
        const cleanPart = part.replace("]", "");

        if (index === 0) {
          currentPath = cleanPart;
        } else {
          if (selectedDiffPath.includes(`[${cleanPart}]`)) {
            currentPath += `[${cleanPart}]`;
          } else {
            currentPath += `.${cleanPart}`;
          }
        }
        paths.add(currentPath);
      });
      paths.add(selectedDiffPath);
    }
    return paths;
  }, [searchMatches1, selectedDiffPath]);

  const expandedPaths2 = useMemo(() => {
    const paths = new Set();
    searchMatches2.forEach((match) => {
      match.parents.forEach((parent) => paths.add(parent));
      paths.add(match.path);
    });
    if (selectedDiffPath) {
      let currentPath = "";
      const pathParts = selectedDiffPath.split(/\.|\[/).filter(Boolean);

      pathParts.forEach((part, index) => {
        const cleanPart = part.replace("]", "");

        if (index === 0) {
          currentPath = cleanPart;
        } else {
          if (selectedDiffPath.includes(`[${cleanPart}]`)) {
            currentPath += `[${cleanPart}]`;
          } else {
            currentPath += `.${cleanPart}`;
          }
        }
        paths.add(currentPath);
      });
      paths.add(selectedDiffPath);
    }
    return paths;
  }, [searchMatches2, selectedDiffPath]);

  const validateJSON = useCallback((text, setError) => {
    if (!text.trim()) {
      setError("");
      return null;
    }
    try {
      const parsed = JSON.parse(text);
      setError("");
      return parsed;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, []);

  const compareJSON = useCallback((obj1, obj2, path = "") => {
    const differences = [];

    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      const maxLength = Math.max(obj1.length, obj2.length);

      for (let i = 0; i < maxLength; i++) {
        const currentPath = `${path}[${i}]`;

        if (i >= obj1.length) {
          differences.push({
            path: currentPath,
            type: "added",
            value: obj2[i],
          });
        } else if (i >= obj2.length) {
          differences.push({
            path: currentPath,
            type: "removed",
            value: obj1[i],
          });
        } else {
          const val1 = obj1[i];
          const val2 = obj2[i];

          if (
            typeof val1 === "object" &&
            val1 !== null &&
            typeof val2 === "object" &&
            val2 !== null
          ) {
            differences.push(...compareJSON(val1, val2, currentPath));
          } else if (val1 !== val2) {
            differences.push({
              path: currentPath,
              type: "modified",
              oldValue: val1,
              newValue: val2,
            });
          }
        }
      }

      return differences;
    }

    const allKeys = new Set([
      ...Object.keys(obj1 || {}),
      ...Object.keys(obj2 || {}),
    ]);

    allKeys.forEach((key) => {
      const currentPath = path ? `${path}.${key}` : key;
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];

      if (!(key in obj1)) {
        differences.push({
          path: currentPath,
          type: "added",
          value: val2,
        });
      } else if (!(key in obj2)) {
        differences.push({
          path: currentPath,
          type: "removed",
          value: val1,
        });
      } else if (
        typeof val1 === "object" &&
        val1 !== null &&
        typeof val2 === "object" &&
        val2 !== null
      ) {
        if (Array.isArray(val1) && Array.isArray(val2)) {
          differences.push(...compareJSON(val1, val2, currentPath));
        } else if (!Array.isArray(val1) && !Array.isArray(val2)) {
          differences.push(...compareJSON(val1, val2, currentPath));
        } else {
          differences.push({
            path: currentPath,
            type: "modified",
            oldValue: val1,
            newValue: val2,
          });
        }
      } else if (val1 !== val2) {
        differences.push({
          path: currentPath,
          type: "modified",
          oldValue: val1,
          newValue: val2,
        });
      }
    });

    return differences;
  }, []);

  const handleCompare = useCallback(() => {
    const parsed1 = validateJSON(json1, setError1);
    const parsed2 = validateJSON(json2, setError2);

    if (parsed1 && parsed2) {
      setParsedJson1(parsed1);
      setParsedJson2(parsed2);
      const diffs = compareJSON(parsed1, parsed2);
      setComparison(diffs);
      setShowComparison(true);
    }
  }, [json1, json2, validateJSON, compareJSON]);

  const loadSamples = useCallback(() => {
    setJson1(JSON.stringify(sampleJSON1, null, 2));
    setJson2(JSON.stringify(sampleJSON2, null, 2));
    setError1("");
    setError2("");
    setFileName1("");
    setFileName2("");
    setShowComparison(false);
    setIsMinified1(false);
    setIsMinified2(false);
  }, []);

  const reset = useCallback(() => {
    setJson1("");
    setJson2("");
    setError1("");
    setError2("");
    setComparison(null);
    setShowComparison(false);
    setFileName1("");
    setFileName2("");
    setSearchTerm("");
    setFilterType("all");
    setIsMinified1(false);
    setIsMinified2(false);
    setParsedJson1(null);
    setParsedJson2(null);
    setHoveredPath1("");
    setHoveredPath2("");
    setPinnedPath1("");
    setPinnedPath2("");
    setSearchTerm1("");
    setSearchTerm2("");
    setCurrentMatchIndex1(-1);
    setCurrentMatchIndex2(-1);
    setSelectedDiffPath("");
  }, []);

  const formatJSON = useCallback(
    (text, setJSON, setError) => {
      const parsed = validateJSON(text, setError);
      if (parsed) {
        setJSON(JSON.stringify(parsed, null, 2));
      }
    },
    [validateJSON]
  );

  const toggleMinify = useCallback(
    (json, setJSON, isMinified, setIsMinified, setError) => {
      const parsed = validateJSON(json, setError);
      if (parsed) {
        if (isMinified) {
          setJSON(JSON.stringify(parsed, null, 2));
          setIsMinified(false);
        } else {
          setJSON(JSON.stringify(parsed));
          setIsMinified(true);
        }
      }
    },
    [validateJSON]
  );

  const swapJSONs = useCallback(() => {
    const tempJSON = json1;
    const tempError = error1;
    const tempFileName = fileName1;
    const tempMinified = isMinified1;

    setJson1(json2);
    setError1(error2);
    setFileName1(fileName2);
    setIsMinified1(isMinified2);

    setJson2(tempJSON);
    setError2(tempError);
    setFileName2(tempFileName);
    setIsMinified2(tempMinified);

    if (showComparison) {
      setTimeout(handleCompare, 100);
    }
  }, [
    json1,
    json2,
    error1,
    error2,
    fileName1,
    fileName2,
    isMinified1,
    isMinified2,
    showComparison,
    handleCompare,
  ]);

  const copyToClipboard = useCallback((text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(""), 2000);
    });
  }, []);

  const getStatistics = useCallback(() => {
    if (!comparison) return { total: 0, added: 0, removed: 0, modified: 0 };

    return {
      total: comparison.length,
      added: comparison.filter((d) => d.type === "added").length,
      removed: comparison.filter((d) => d.type === "removed").length,
      modified: comparison.filter((d) => d.type === "modified").length,
    };
  }, [comparison]);

  const getFilteredComparison = useCallback(() => {
    if (!comparison) return [];

    let filtered = comparison;

    if (filterType !== "all") {
      filtered = filtered.filter((d) => d.type === filterType);
    }

    if (searchTerm) {
      filtered = filtered.filter((d) =>
        d.path.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [comparison, filterType, searchTerm]);

  const handleFileRead = useCallback(
    (file, setJSON, setError, setFileName) => {
      if (!file) return;

      if (!file.name.endsWith(".json")) {
        setError("Please upload a JSON file");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        setJSON(content);
        validateJSON(content, setError);
        setFileName(file.name);
      };
      reader.onerror = () => {
        setError("Failed to read file");
      };
      reader.readAsText(file);
    },
    [validateJSON]
  );

  const handleFileUpload = useCallback(
    (e, setJSON, setError, setFileName) => {
      const file = e.target.files[0];
      handleFileRead(file, setJSON, setError, setFileName);
    },
    [handleFileRead]
  );

  const handleDragOver = useCallback((e, setDragOver) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e, setDragOver) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e, setJSON, setError, setFileName, setDragOver) => {
      e.preventDefault();
      setDragOver(false);

      const file = e.dataTransfer.files[0];
      handleFileRead(file, setJSON, setError, setFileName);
    },
    [handleFileRead]
  );

  const handlePinPath1 = useCallback(
    (path) => {
      setPinnedPath1(pinnedPath1 === path ? "" : path);
    },
    [pinnedPath1]
  );

  const handlePinPath2 = useCallback(
    (path) => {
      setPinnedPath2(pinnedPath2 === path ? "" : path);
    },
    [pinnedPath2]
  );

  const handleSearchKeyDown1 = useCallback(
    (e) => {
      if (e.key === "Enter" && searchMatches1.length > 0) {
        e.preventDefault();
        const nextIndex = (currentMatchIndex1 + 1) % searchMatches1.length;
        setCurrentMatchIndex1(nextIndex);
      }
    },
    [searchMatches1, currentMatchIndex1]
  );

  const handleSearchKeyDown2 = useCallback(
    (e) => {
      if (e.key === "Enter" && searchMatches2.length > 0) {
        e.preventDefault();
        const nextIndex = (currentMatchIndex2 + 1) % searchMatches2.length;
        setCurrentMatchIndex2(nextIndex);
      }
    },
    [searchMatches2, currentMatchIndex2]
  );

  const handleDiffClick = useCallback((path) => {
    setSelectedDiffPath(path);
    setPinnedPath1(path);
    setPinnedPath2(path);

    setTimeout(() => {
      const element1 = scrollRef1.current?.querySelector(
        `[data-path="${path}"]`
      );
      const element2 = scrollRef2.current?.querySelector(
        `[data-path="${path}"]`
      );

      if (element1) {
        element1.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (element2) {
        element2.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 400);
  }, []);

  useEffect(() => {
    setCurrentMatchIndex1(-1);
  }, [debouncedSearchTerm1]);

  useEffect(() => {
    setCurrentMatchIndex2(-1);
  }, [debouncedSearchTerm2]);

  const stats = useMemo(() => getStatistics(), [getStatistics]);
  const filteredComparison = useMemo(
    () => getFilteredComparison(),
    [getFilteredComparison]
  );

  const truncateValue = useCallback((val, maxLength = 50) => {
    const str = JSON.stringify(val);
    return str.length > maxLength ? str.substring(0, maxLength) + "..." : str;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 pt-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileJson className="w-12 h-12 text-purple-400" />
            <h1 className="text-5xl font-bold text-white">JSON Comparator</h1>
          </div>
          <p className="text-purple-200 text-lg">
            Compare JSON objects side-by-side with tree view
          </p>
        </div>

        <div className="flex gap-3 mb-6 justify-center flex-wrap">
          <button
            onClick={loadSamples}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Copy className="w-4 h-4" />
            Load Sample
          </button>
          <button
            onClick={swapJSONs}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            title="Swap left and right JSON"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Swap
          </button>
          <button
            onClick={handleCompare}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors font-semibold"
          >
            <GitCompare className="w-4 h-4" />
            Compare
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>

        {showComparison && comparison && (
          <div className="mb-6">
            <div className="bg-slate-800/50 backdrop-blur rounded-t-xl p-4 border border-purple-500/30 border-b-0">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <GitCompare className="w-6 h-6 text-purple-400" />
                    Tree View Comparison
                  </h3>
                  <div className="flex gap-3 text-sm">
                    <span className="px-3 py-1 bg-purple-900/50 text-purple-200 rounded-full">
                      Total:{" "}
                      <strong className="text-white">{stats.total}</strong>
                    </span>
                    <span className="px-3 py-1 bg-green-900/50 text-green-300 rounded-full">
                      Added:{" "}
                      <strong className="text-green-400">{stats.added}</strong>
                    </span>
                    <span className="px-3 py-1 bg-red-900/50 text-red-300 rounded-full">
                      Removed:{" "}
                      <strong className="text-red-400">{stats.removed}</strong>
                    </span>
                    <span className="px-3 py-1 bg-yellow-900/50 text-yellow-300 rounded-full">
                      Modified:{" "}
                      <strong className="text-yellow-400">
                        {stats.modified}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap items-center">
                  <div className="relative">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none" />
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="pl-10 pr-4 py-1.5 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none text-sm appearance-none cursor-pointer"
                    >
                      <option value="all">All Changes</option>
                      <option value="added">Added Only</option>
                      <option value="removed">Removed Only</option>
                      <option value="modified">Modified Only</option>
                    </select>
                  </div>

                  {comparison.length > 0 && (
                    <>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            JSON.stringify(comparison, null, 2),
                            "results"
                          )
                        }
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 text-sm transition-colors"
                      >
                        {copied === "results" ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        {copied === "results" ? "Copied!" : "Copy"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {filteredComparison.length > 0 && (
                <div className="mt-4 max-h-60 overflow-y-auto bg-slate-900/50 rounded-lg p-3">
                  <div className="text-sm text-purple-200 mb-3 font-semibold flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    {filteredComparison.length} Difference(s) - Click to view
                  </div>
                  <div className="space-y-2">
                    {filteredComparison.map((diff, index) => (
                      <div
                        key={index}
                        onClick={() => handleDiffClick(diff.path)}
                        className={`p-2 rounded-lg border cursor-pointer transition-all hover:scale-[1.01] ${selectedDiffPath === diff.path
                            ? "border-purple-500 bg-purple-900/30 ring-2 ring-purple-500"
                            : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                          } ${diff.type === "added"
                            ? "hover:bg-green-900/20"
                            : diff.type === "removed"
                              ? "hover:bg-red-900/20"
                              : "hover:bg-yellow-900/20"
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${diff.type === "added"
                                ? "bg-green-600/50 text-green-200"
                                : diff.type === "removed"
                                  ? "bg-red-600/50 text-red-200"
                                  : "bg-yellow-600/50 text-yellow-200"
                              }`}
                          >
                            {diff.type.toUpperCase()}
                          </span>
                          <code className="text-xs text-purple-300 font-mono">
                            {diff.path}
                          </code>
                        </div>
                        <div className="text-xs text-slate-300 font-mono ml-2">
                          {diff.type === "added" && (
                            <div className="flex items-center gap-1">
                              <span className="text-green-400">+</span>
                              <span className="text-emerald-300">
                                {truncateValue(diff.value)}
                              </span>
                            </div>
                          )}
                          {diff.type === "removed" && (
                            <div className="flex items-center gap-1">
                              <span className="text-red-400">-</span>
                              <span className="text-red-300">
                                {truncateValue(diff.value)}
                              </span>
                            </div>
                          )}
                          {diff.type === "modified" && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <span className="text-red-400">-</span>
                                <span className="text-red-300">
                                  {truncateValue(diff.oldValue)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-green-400">+</span>
                                <span className="text-green-300">
                                  {truncateValue(diff.newValue)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {comparison.length === 0 ? (
              <div className="bg-slate-800/50 backdrop-blur rounded-b-xl p-8 border border-purple-500/30 border-t-0 text-center">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-3" />
                <p className="text-xl text-green-400 font-semibold">
                  JSONs are identical!
                </p>
                <p className="text-purple-200 mt-2">No differences found</p>
              </div>
            ) : (
              <div className="bg-slate-800/50 backdrop-blur rounded-b-xl border border-purple-500/30 border-t-0 overflow-hidden">
                <div className="grid md:grid-cols-2 gap-4 bg-slate-900/30 p-4">
                  <div>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search ... "
                        value={searchTerm1}
                        onChange={(e) => setSearchTerm1(e.target.value)}
                        onKeyDown={handleSearchKeyDown1}
                        className="w-full pl-10 pr-10 py-2 bg-slate-900/50 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none text-sm"
                      />
                      {searchTerm1 && (
                        <button
                          onClick={() => {
                            setSearchTerm1("");
                            setCurrentMatchIndex1(-1);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {debouncedSearchTerm1 && (
                      <div className="mt-2 text-xs text-yellow-400 flex items-center justify-between">
                        <span>{searchMatches1.length} match(es)</span>
                        {searchMatches1.length > 0 && (
                          <span className="text-purple-300">
                            {currentMatchIndex1 >= 0
                              ? `${currentMatchIndex1 + 1}/${searchMatches1.length
                              }`
                              : "Press Enter →"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search (typing appears immediately)..."
                        value={searchTerm2}
                        onChange={(e) => setSearchTerm2(e.target.value)}
                        onKeyDown={handleSearchKeyDown2}
                        className="w-full pl-10 pr-10 py-2 bg-slate-900/50 text-white rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none text-sm"
                      />
                      {searchTerm2 && (
                        <button
                          onClick={() => {
                            setSearchTerm2("");
                            setCurrentMatchIndex2(-1);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {debouncedSearchTerm2 && (
                      <div className="mt-2 text-xs text-yellow-400 flex items-center justify-between">
                        <span>{searchMatches2.length} match(es)</span>
                        {searchMatches2.length > 0 && (
                          <span className="text-purple-300">
                            {currentMatchIndex2 >= 0
                              ? `${currentMatchIndex2 + 1}/${searchMatches2.length
                              }`
                              : "Press Enter →"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-px bg-slate-700/30">
                  <div className="bg-slate-900/50 p-4">
                    <JSONTree
                      data={parsedJson1}
                      differences={comparison}
                      isLeft={true}
                      onPathHover={setHoveredPath1}
                      currentPath={hoveredPath1}
                      onPathPin={handlePinPath1}
                      pinnedPath={pinnedPath1}
                      onClearPath={() => setPinnedPath1("")}
                      searchMatches={searchMatches1}
                      searchTerm={debouncedSearchTerm1}
                      currentMatchIndex={currentMatchIndex1}
                      expandedPaths={expandedPaths1}
                      scrollRef={scrollRef1}
                      selectedPath={selectedDiffPath}
                    />
                  </div>

                  <div className="bg-slate-900/50 p-4">
                    <JSONTree
                      data={parsedJson2}
                      differences={comparison}
                      isLeft={false}
                      onPathHover={setHoveredPath2}
                      currentPath={hoveredPath2}
                      onPathPin={handlePinPath2}
                      pinnedPath={pinnedPath2}
                      onClearPath={() => setPinnedPath2("")}
                      searchMatches={searchMatches2}
                      searchTerm={debouncedSearchTerm2}
                      currentMatchIndex={currentMatchIndex2}
                      expandedPaths={expandedPaths2}
                      scrollRef={scrollRef2}
                      selectedPath={selectedDiffPath}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <span className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm">
                  1
                </span>
                First JSON
              </h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => fileInput1Ref.current?.click()}
                  className="text-sm px-3 py-1 bg-purple-600/50 hover:bg-purple-600 text-white rounded transition-colors flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  Upload
                </button>
                <button
                  onClick={() =>
                    toggleMinify(
                      json1,
                      setJson1,
                      isMinified1,
                      setIsMinified1,
                      setError1
                    )
                  }
                  className="text-sm px-3 py-1 bg-purple-600/50 hover:bg-purple-600 text-white rounded transition-colors flex items-center gap-1"
                  title={isMinified1 ? "Expand" : "Minify"}
                >
                  {isMinified1 ? (
                    <Maximize2 className="w-3 h-3" />
                  ) : (
                    <Minimize2 className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() => formatJSON(json1, setJson1, setError1)}
                  className="text-sm px-3 py-1 bg-purple-600/50 hover:bg-purple-600 text-white rounded transition-colors"
                >
                  Format
                </button>
                <button
                  onClick={() => copyToClipboard(json1, "json1")}
                  className="text-sm px-3 py-1 bg-purple-600/50 hover:bg-purple-600 text-white rounded transition-colors flex items-center gap-1"
                >
                  {copied === "json1" ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>

            <input
              ref={fileInput1Ref}
              type="file"
              accept=".json"
              onChange={(e) =>
                handleFileUpload(e, setJson1, setError1, setFileName1)
              }
              className="hidden"
            />

            {fileName1 && (
              <div className="mb-2 text-sm text-purple-300 flex items-center gap-2">
                <FileJson className="w-4 h-4" />
                <span className="truncate">{fileName1}</span>
              </div>
            )}

            <div
              onDragOver={(e) => handleDragOver(e, setDragOver1)}
              onDragLeave={(e) => handleDragLeave(e, setDragOver1)}
              onDrop={(e) =>
                handleDrop(e, setJson1, setError1, setFileName1, setDragOver1)
              }
              className={`relative ${dragOver1 ? "ring-2 ring-purple-500" : ""
                }`}
            >
              <textarea
                value={json1}
                onChange={(e) => {
                  setJson1(e.target.value);
                  validateJSON(e.target.value, setError1);
                }}
                placeholder="Paste JSON or drag & drop a .json file here"
                className="w-full h-64 bg-slate-900/50 text-green-400 font-mono text-sm p-4 rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none resize-none"
              />
              {dragOver1 && (
                <div className="absolute inset-0 bg-purple-600/20 rounded-lg flex items-center justify-center pointer-events-none">
                  <div className="text-purple-300 font-semibold flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Drop JSON file here
                  </div>
                </div>
              )}
            </div>

            {error1 && (
              <div className="mt-2 flex items-start gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error1}</span>
              </div>
            )}
            {!error1 && json1 && (
              <div className="mt-2 flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Valid JSON</span>
              </div>
            )}
          </div>

          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">
                  2
                </span>
                Second JSON
              </h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => fileInput2Ref.current?.click()}
                  className="text-sm px-3 py-1 bg-blue-600/50 hover:bg-blue-600 text-white rounded transition-colors flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  Upload
                </button>
                <button
                  onClick={() =>
                    toggleMinify(
                      json2,
                      setJson2,
                      isMinified2,
                      setIsMinified2,
                      setError2
                    )
                  }
                  className="text-sm px-3 py-1 bg-blue-600/50 hover:bg-blue-600 text-white rounded transition-colors flex items-center gap-1"
                  title={isMinified2 ? "Expand" : "Minify"}
                >
                  {isMinified2 ? (
                    <Maximize2 className="w-3 h-3" />
                  ) : (
                    <Minimize2 className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() => formatJSON(json2, setJson2, setError2)}
                  className="text-sm px-3 py-1 bg-blue-600/50 hover:bg-blue-600 text-white rounded transition-colors"
                >
                  Format
                </button>
                <button
                  onClick={() => copyToClipboard(json2, "json2")}
                  className="text-sm px-3 py-1 bg-blue-600/50 hover:bg-blue-600 text-white rounded transition-colors flex items-center gap-1"
                >
                  {copied === "json2" ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>

            <input
              ref={fileInput2Ref}
              type="file"
              accept=".json"
              onChange={(e) =>
                handleFileUpload(e, setJson2, setError2, setFileName2)
              }
              className="hidden"
            />

            {fileName2 && (
              <div className="mb-2 text-sm text-blue-300 flex items-center gap-2">
                <FileJson className="w-4 h-4" />
                <span className="truncate">{fileName2}</span>
              </div>
            )}

            <div
              onDragOver={(e) => handleDragOver(e, setDragOver2)}
              onDragLeave={(e) => handleDragLeave(e, setDragOver2)}
              onDrop={(e) =>
                handleDrop(e, setJson2, setError2, setFileName2, setDragOver2)
              }
              className={`relative ${dragOver2 ? "ring-2 ring-blue-500" : ""}`}
            >
              <textarea
                value={json2}
                onChange={(e) => {
                  setJson2(e.target.value);
                  validateJSON(e.target.value, setError2);
                }}
                placeholder="Paste JSON or drag & drop a .json file here"
                className="w-full h-64 bg-slate-900/50 text-green-400 font-mono text-sm p-4 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none resize-none"
              />
              {dragOver2 && (
                <div className="absolute inset-0 bg-blue-600/20 rounded-lg flex items-center justify-center pointer-events-none">
                  <div className="text-blue-300 font-semibold flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Drop JSON file here
                  </div>
                </div>
              )}
            </div>

            {error2 && (
              <div className="mt-2 flex items-start gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error2}</span>
              </div>
            )}
            {!error2 && json2 && (
              <div className="mt-2 flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Valid JSON</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JSONCompare;
