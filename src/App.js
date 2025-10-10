import React, { useState, useRef } from "react";
import {
  FileJson,
  GitCompare,
  AlertCircle,
  CheckCircle,
  Copy,
  RotateCcw,
  Upload,
  Download,
  ArrowLeftRight,
  Search,
  Filter,
  Minimize2,
  Maximize2,
  Check,
} from "lucide-react";

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

  const fileInput1Ref = useRef(null);
  const fileInput2Ref = useRef(null);

  const sampleJSON1 = {
    name: "John Doe",
    age: 30,
    email: "john@example.com",
    address: {
      city: "New York",
      country: "USA",
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
    },
    hobbies: ["reading", "coding", "gaming"],
  };

  const validateJSON = (text, setError) => {
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
  };

  const compareJSON = (obj1, obj2, path = "") => {
    const differences = [];

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
          if (JSON.stringify(val1) !== JSON.stringify(val2)) {
            differences.push({
              path: currentPath,
              type: "modified",
              oldValue: val1,
              newValue: val2,
            });
          }
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
  };

  const handleCompare = () => {
    const parsed1 = validateJSON(json1, setError1);
    const parsed2 = validateJSON(json2, setError2);

    if (parsed1 && parsed2) {
      const diffs = compareJSON(parsed1, parsed2);
      setComparison(diffs);
      setShowComparison(true);
    }
  };

  const loadSamples = () => {
    setJson1(JSON.stringify(sampleJSON1, null, 2));
    setJson2(JSON.stringify(sampleJSON2, null, 2));
    setError1("");
    setError2("");
    setFileName1("");
    setFileName2("");
    setShowComparison(false);
    setIsMinified1(false);
    setIsMinified2(false);
  };

  const reset = () => {
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
  };

  const formatJSON = (text, setJSON, setError) => {
    const parsed = validateJSON(text, setError);
    if (parsed) {
      setJSON(JSON.stringify(parsed, null, 2));
    }
  };

  const toggleMinify = (json, setJSON, isMinified, setIsMinified, setError) => {
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
  };

  const swapJSONs = () => {
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
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(""), 2000);
    });
  };

  const exportAsJSON = () => {
    const data = {
      comparison: comparison,
      statistics: getStatistics(),
      json1: JSON.parse(json1),
      json2: JSON.parse(json2),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "json-comparison.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsText = () => {
    const stats = getStatistics();
    let text = "=== JSON COMPARISON REPORT ===\n\n";
    text += `Total Differences: ${comparison.length}\n`;
    text += `Added: ${stats.added}\n`;
    text += `Removed: ${stats.removed}\n`;
    text += `Modified: ${stats.modified}\n\n`;
    text += "=== DETAILED DIFFERENCES ===\n\n";

    comparison.forEach((diff, index) => {
      text += `${index + 1}. [${diff.type.toUpperCase()}] ${diff.path}\n`;
      if (diff.type === "added") {
        text += `   + Value: ${JSON.stringify(diff.value)}\n`;
      } else if (diff.type === "removed") {
        text += `   - Value: ${JSON.stringify(diff.value)}\n`;
      } else {
        text += `   - Old: ${JSON.stringify(diff.oldValue)}\n`;
        text += `   + New: ${JSON.stringify(diff.newValue)}\n`;
      }
      text += "\n";
    });

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "json-comparison.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatistics = () => {
    if (!comparison) return { total: 0, added: 0, removed: 0, modified: 0 };

    return {
      total: comparison.length,
      added: comparison.filter((d) => d.type === "added").length,
      removed: comparison.filter((d) => d.type === "removed").length,
      modified: comparison.filter((d) => d.type === "modified").length,
    };
  };

  const getFilteredComparison = () => {
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
  };

  const handleFileRead = (file, setJSON, setError, setFileName) => {
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
  };

  const handleFileUpload = (e, setJSON, setError, setFileName) => {
    const file = e.target.files[0];
    handleFileRead(file, setJSON, setError, setFileName);
  };

  const handleDragOver = (e, setDragOver) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e, setDragOver) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e, setJSON, setError, setFileName, setDragOver) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    handleFileRead(file, setJSON, setError, setFileName);
  };

  const stats = getStatistics();
  const filteredComparison = getFilteredComparison();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileJson className="w-12 h-12 text-purple-400" />
            <h1 className="text-5xl font-bold text-white">JSON Comparator</h1>
          </div>
          <p className="text-purple-200 text-lg">
            Compare JSON objects and visualize differences
          </p>
        </div>

        {/* Action Buttons */}
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

        {/* JSON Input Areas */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* JSON 1 */}
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

          {/* JSON 2 */}
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

        {/* Statistics Dashboard */}
        {showComparison && comparison && comparison.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-purple-500/30 mb-6">
            <h3 className="text-xl font-semibold text-white mb-4">
              📊 Statistics Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-4 border border-purple-500/20">
                <div className="text-3xl font-bold text-white">
                  {stats.total}
                </div>
                <div className="text-purple-300 text-sm mt-1">
                  Total Changes
                </div>
              </div>
              <div className="bg-green-900/20 rounded-lg p-4 border border-green-500/30">
                <div className="text-3xl font-bold text-green-400">
                  {stats.added}
                </div>
                <div className="text-green-300 text-sm mt-1">Added</div>
              </div>
              <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/30">
                <div className="text-3xl font-bold text-red-400">
                  {stats.removed}
                </div>
                <div className="text-red-300 text-sm mt-1">Removed</div>
              </div>
              <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-500/30">
                <div className="text-3xl font-bold text-yellow-400">
                  {stats.modified}
                </div>
                <div className="text-yellow-300 text-sm mt-1">Modified</div>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Results */}
        {showComparison && comparison && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-purple-500/30">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-2xl font-semibold text-white flex items-center gap-2">
                <GitCompare className="w-6 h-6 text-purple-400" />
                Comparison Results
              </h3>

              {comparison.length > 0 && (
                <div className="flex gap-2 flex-wrap">
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
                  <button
                    onClick={exportAsJSON}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 text-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    JSON
                  </button>
                  <button
                    onClick={exportAsText}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 text-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Text
                  </button>
                </div>
              )}
            </div>

            {comparison.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-3" />
                <p className="text-xl text-green-400 font-semibold">
                  JSONs are identical!
                </p>
                <p className="text-purple-200 mt-2">No differences found</p>
              </div>
            ) : (
              <>
                {/* Search and Filter */}
                <div className="flex gap-3 mb-4 flex-wrap">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" />
                    <input
                      type="text"
                      placeholder="Search by path..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-900/50 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" />
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-slate-900/50 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none text-sm appearance-none cursor-pointer"
                    >
                      <option value="all">All Changes</option>
                      <option value="added">Added Only</option>
                      <option value="removed">Removed Only</option>
                      <option value="modified">Modified Only</option>
                    </select>
                  </div>
                </div>

                <div className="text-purple-200 mb-4">
                  Showing{" "}
                  <span className="font-bold text-white">
                    {filteredComparison.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-white">
                    {comparison.length}
                  </span>{" "}
                  difference(s)
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {filteredComparison.map((diff, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-l-4 ${diff.type === "added"
                          ? "bg-green-900/20 border-green-500"
                          : diff.type === "removed"
                            ? "bg-red-900/20 border-red-500"
                            : "bg-yellow-900/20 border-yellow-500"
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold flex-shrink-0 ${diff.type === "added"
                              ? "bg-green-600 text-white"
                              : diff.type === "removed"
                                ? "bg-red-600 text-white"
                                : "bg-yellow-600 text-white"
                            }`}
                        >
                          {diff.type.toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-purple-200 font-mono text-sm mb-2 break-all">
                            <span className="text-purple-400">Path:</span>{" "}
                            {diff.path}
                          </p>
                          {diff.type === "added" && (
                            <p className="text-green-300 font-mono text-sm break-all">
                              <span className="text-green-400">+ Value:</span>{" "}
                              {JSON.stringify(diff.value)}
                            </p>
                          )}
                          {diff.type === "removed" && (
                            <p className="text-red-300 font-mono text-sm break-all">
                              <span className="text-red-400">- Value:</span>{" "}
                              {JSON.stringify(diff.value)}
                            </p>
                          )}
                          {diff.type === "modified" && (
                            <div className="space-y-1">
                              <p className="text-red-300 font-mono text-sm break-all">
                                <span className="text-red-400">- Old:</span>{" "}
                                {JSON.stringify(diff.oldValue)}
                              </p>
                              <p className="text-green-300 font-mono text-sm break-all">
                                <span className="text-green-400">+ New:</span>{" "}
                                {JSON.stringify(diff.newValue)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JSONCompare;
