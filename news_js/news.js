// news_js/news.js - Core logic for the News & Journalism page
(function () {
  "use strict";

  // ─── State ───────────────────────────────────────────────────────────────
  const state = {
    allArticles: [], // All discovered articles
    publishers: new Set(), // Unique publisher names
    years: new Set(), // Unique year numbers
    activePublisher: null, // Currently filtered publisher
    activeYear: null, // Currently filtered year
    viewingArticle: null, // Currently viewed article
  };

  // ─── Constants ───────────────────────────────────────────────────────────
  const NEWS_SOURCES_PATH = "news_sources/";

  // ─── Utility: Parse JSON snippet from article text ──────────────────────
  function parseArticleHeader(text) {
    const lines = text.split("\n");
    let jsonStr = "";
    let contentStartLine = 0;

    // Try to extract JSON from first line
    if (lines[0] && lines[0].trim().startsWith("{")) {
      try {
        jsonStr = lines[0].trim();
        const parsed = JSON.parse(jsonStr);
        contentStartLine = 1;
        return {
          metadata: parsed,
          content: lines.slice(1).join("\n"),
          valid: true,
        };
      } catch (e) {
        // Invalid JSON, treat entire file as content
        return { metadata: null, content: text, valid: false };
      }
    }

    return { metadata: null, content: text, valid: false };
  }

  // ─── Utility: Convert article text to HTML paragraphs ────────────────────
  function textToHtml(text) {
    // Split by double newlines to get paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    return paragraphs
      .map((p) => {
        const trimmed = p.trim();
        if (!trimmed) return "";
        // Preserve line breaks within paragraphs
        const lines = trimmed.split("\n");
        return "<p>" + lines.join("<br>") + "</p>";
      })
      .filter(Boolean)
      .join("\n");
  }

  // ─── Built-in publishers (fallback for when manifest.json doesn't exist) ──
  async function loadBuiltInPublishers() {
    const builtInPublishers = [
      {
        name: "South_Road_Journal",
        displayName: "South Road Journal",
        years: ["year2", "year3", "year4"],
      },
    ];

    state.publishers = new Set(builtInPublishers.map((p) => p.name));

    // Load publisher metadata
    for (const pub of builtInPublishers) {
      try {
        const pubResp = await fetch(
          NEWS_SOURCES_PATH + pub.name + "/publisher.txt",
        );
        if (pubResp.ok) {
          pub.metadata = await pubResp.text();
        }
      } catch (e) {
        console.warn("[news] Could not load publisher metadata for", pub.name);
      }
    }

    // Load all articles
    for (const pub of builtInPublishers) {
      for (const year of pub.years) {
        state.years.add(year);

        try {
          const articleFiles = [
            "jul-30-y2-tyron-calls-for-rate-hikes-markets-crash.txt",
            "sep-18-y2-no-perch-in-perch-point.txt",
            "sep-29-y2-skepping-youth-trend-out-of-control.txt",
            "oct-23-y2-temporal-storms-leading-cause-of-anxiety.txt",
            "dec-11-y2-miracle-appetite-enhancing-drug-changes-lives.txt",
            "jan-19-y3-highway-elk-collisions-mar-holidays.txt",
            "feb-17-y3-year-on-year-workplace-injuries-soar.txt",
            "mar-16-y3-omok-world-champion-caught-cheating.txt",
            "apr-21-y3-antler-day-celebrates-tops-beloved-tradition.txt",
            "may-22-y3-fishy-business-in-perch-point.txt",
            "jun-24-y3-cube-of-tobias-wonder-of-tops.txt",
            "jul-15-y3-pie-faced-citizens-fed-up.txt",
            "sep-15-y3-traffic-snarls-on-south-road-as-construction-stalls.txt",
            "nov-15-y3-new-mortar-regulations-spark-protest.txt",
            "dec-25-y3-coal-scam-ruins-holidays.txt",
            "jan-18-y4-following-the-lead-toxic-exposure.txt",
            "mar-22-y4-fabled-shears-of-oahka123-exist-claims-tops-u-prof.txt",
            "jun-7-y4-local-menace-terrorizes-citizens.txt",
            "jun-18-y4-terra-preta-demand-causes-famine.txt",
            "oct-1-y4-south-road-journal-acquired.txt",
          ];
          // My last fix for loading articles, located deep within loadBuiltInPublishers()
          for (const filename of articleFiles) {
            try {
              const articleResp = await fetch(
                // <-- The try block starts here
                NEWS_SOURCES_PATH + pub.name + "/" + year + "/" + filename,
              );
              if (!articleResp.ok) {
                // Skip articles that return a 404 or other non-OK status
                console.warn(
                  `[news] Skipping article ${filename}: HTTP Status ${articleResp.status}`,
                );
                continue;
              }

              const articleText = await articleResp.text(); // <-- The try block ends here implicitly by moving to success code
              // ... rest of the logic
            } catch (e) {
              // Catches network errors or issues reading the response body for a single file
              console.warn(`[news] Failed to load article ${filename}:`, e);
            } // <-- The catch block ends here
          }
          for (const filename of articleFiles) {
            const articleResp = await fetch(
              NEWS_SOURCES_PATH + pub.name + "/" + year + "/" + filename,
            );
            if (!articleResp.ok) continue;

            const articleText = await articleResp.text();
            const parsed = parseArticleHeader(articleText);

            state.allArticles.push({
              id: pub.name + "/" + year + "/" + filename,
              publisher: pub.name,
              publisherDisplayName: pub.displayName || pub.name,
              year: year,
              title: parsed.metadata?.title || "Untitled",
              date: parsed.metadata?.date || "Unknown",
              author: parsed.metadata?.author || "Unknown",
              images: parsed.metadata?.images || [],
              rawContent: parsed.content,
              parsedContent: textToHtml(parsed.content),
              filename: filename,
            });
          }
        } catch (e) {
          console.warn("[news] Could not load articles for", pub.name, year);
        }
      }
    }

    // Sort articles by date (Year X -> Month -> Day)
    state.allArticles.sort((a, b) => {
      const yearA = parseInt(a.year.replace("year", "")) || 0;
      const yearB = parseInt(b.year.replace("year", "")) || 0;
      if (yearA !== yearB) return yearB - yearA;
      return a.title.localeCompare(b.title);
    });

    renderPublisherFilter();
    renderYearFilter();
    renderArticleList();
  }
  // ─── Render publisher filter ─────────────────────────────────────────────
  function renderPublisherFilter() {
    const container = document.getElementById("publisher-list");
    if (!container) return;

    let html =
      '<button class="publisher-btn active" data-publisher="all">All Publishers</button>';

    for (const pub of state.publishers) {
      html +=
        '<button class="publisher-btn" data-publisher="' +
        pub +
        '">' +
        pub.replace(/_/g, " ") +
        "</button>";
    }

    container.innerHTML = html;

    // FIX: Wrap event listener attachment in a self-executing scope
    // to ensure proper closure capturing of all necessary functions.
    (function () {
      const attachPublisherListeners = (e) => {
        if (!e.target.classList.contains("publisher-btn")) return;

        const publisher = e.target.dataset.publisher;
        state.activePublisher = publisher === "all" ? null : publisher;

        // Update active state
        container.querySelectorAll(".publisher-btn").forEach((btn) => {
          btn.classList.remove("active");
        });
        e.target.classList.add("active");

        renderArticleList();
      };

      // ...
      container.addEventListener("click", attachPublisherListeners);
    })(); // This closes the IIFE
  }

  // ─── Render year filter ──────────────────────────────────────────────────
  function renderYearFilter() {
    const container = document.getElementById("year-list");
    if (!container) return;

    // Extract year numbers from year folders (year2, year3, etc.)
    const yearNumbers = Array.from(state.years)
      .map((y) => parseInt(y.replace("year", "")))
      .sort((a, b) => b - a);

    let html =
      '<button class="year-btn active" data-year="all">All Years</button>';

    for (const year of yearNumbers) {
      html +=
        '<button class="year-btn" data-year="' +
        "year" +
        year +
        '">Year ' +
        year +
        "</button>";
    }

    container.innerHTML = html;

    // FIX: Wrap event listener attachment in a self-executing scope
    (function () {
      const attachYearListeners = (e) => {
        if (!e.target.classList.contains("year-btn")) return;

        const yearKey = e.target.dataset.year; // Captures "year3" now
        state.activeYear = yearKey === "all" ? null : yearKey;

        // Update active state
        container.querySelectorAll(".year-btn").forEach((btn) => {
          btn.classList.remove("active");
        });
        e.target.classList.add("active");

        renderArticleList();
      };

      container.addEventListener("click", attachYearListeners);
    })();
  }

  // ─── Render article list ─────────────────────────────────────────────────
  function renderArticleList() {
    const container = document.getElementById("article-list");
    if (!container) return;

    // Filter articles
    let filtered = state.allArticles;
    if (state.activePublisher) {
      filtered = filtered.filter((a) => a.publisher === state.activePublisher);
    }
    if (state.activeYear) {
      filtered = filtered.filter((a) => a.year === state.activeYear);
    }

    if (filtered.length === 0) {
      container.innerHTML =
        '<p class="no-articles">No articles found for the selected filters.</p>';
      return;
    }

    let html = "";
    for (const article of filtered) {
      // Build the structured card HTML with explicit spacing and grouping
      html += '<div class="article-card" data-id="' + article.id + '">';

      // 1. Meta Info Block (Publisher & Year) - Added dedicated structure for spacing/grouping
      html += `<div class="article-meta-info">`;
      html += `<span class="article-publisher">${article.publisherDisplayName}</span>`;
      html += ` <span class="separator"> | </span>`;
      html += `<span class="article-year">${article.year.replace("year", "Year ")}</span>`;
      html += `</div>`; // Closing tag added

      // 2. Article Title, Date, Author Block
      html += '<h3 class="article-title">' + article.title + "</h3>";
      html += '<p class="article-date">Date: ' + article.date + "</p>";
      html += '<p class="article-author">By ' + article.author + "</p>";

      // The outer div closing was redundant, leaving it open for structure clarity
      html += "</div>";
    }

    container.innerHTML = html;

    // FIX: Wrap event listener attachment in a self-executing scope
    (function () {
      const attachArticleListeners = (e) => {
        const card = e.target.closest(".article-card");
        if (card) {
          const articleId = card.dataset.id;
          showArticle(articleId); // showArticle is now guaranteed to be in scope here
        }
      };

      container.addEventListener("click", attachArticleListeners);
    })();
  }

  // ─── Show article detail ─────────────────────────────────────────────────
  function showArticle(articleId) {
    const article = state.allArticles.find((a) => a.id === articleId);
    if (!article) return;

    state.viewingArticle = article;

    // Hide feed, show detail
    document.getElementById("news-feed").style.display = "none";
    document.getElementById("article-detail").style.display = "block";

    // Build article content
    const contentContainer = document.getElementById("article-content");
    let html = "";

    // Header
    html += '<div class="article-detail-header">';
    html += "<h1>" + article.title + "</h1>";
    html += '<div class="article-meta">';
    html +=
      '<span class="meta-publisher">Publisher: <strong>' +
      article.publisherDisplayName +
      "</strong></span>";
    html += '<span class="meta-date">Date: ' + article.date + "</span>";
    html += '<span class="meta-author">Author: ' + article.author + "</span>";
    html += "</div>";
    html += "</div>";

    // Images (if any)
    if (article.images && article.images.length > 0) {
      html += '<div class="article-images">';
      for (const img of article.images) {
        html += '<div class="article-image">';
        html +=
          '<img src="' +
          NEWS_SOURCES_PATH +
          article.publisher +
          "/" +
          article.year +
          "/images/" +
          img.path +
          '" alt="' +
          (img.caption || "") +
          '">';
        if (img.caption) {
          html += '<p class="image-caption">' + img.caption + "</p>";
        }
        html += "</div>";
      }
      html += "</div>";
    }

    // Content
    html += '<div class="article-body">' + article.parsedContent + "</div>";

    contentContainer.innerHTML = html;

    // Update back button
    document.getElementById("back-to-feed").onclick = function () {
      document.getElementById("news-feed").style.display = "block";
      document.getElementById("article-detail").style.display = "none";
      state.viewingArticle = null;
      window.scrollTo(0, 0);
    };

    window.scrollTo(0, 0);
  }

  // ─── Initialize ──────────────────────────────────────────────────────────
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", loadBuiltInPublishers);
    } else {
      loadBuiltInPublishers();
    }
  }

  // Export for testing
  window.newsJs = {
    loadBuiltInPublishers: loadBuiltInPublishers,
    showArticle: showArticle,
    parseArticleHeader: parseArticleHeader,
    textToHtml: textToHtml,
    state: state,
  };

  // Start
  init();
})();
