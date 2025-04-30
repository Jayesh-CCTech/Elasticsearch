const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// OpenSearch URL
const OPENSEARCH_URL = process.env.OPENSEARCH_URL || "http://localhost:9200";

// Create axios instance for OpenSearch
const opensearchClient = axios.create({
  baseURL: OPENSEARCH_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Health Check Endpoint
app.get("/api/health", async (req, res) => {
  try {
    const response = await opensearchClient.get("/");
    res.status(200).json({
      status: "ok",
      opensearch: "connected",
      version: response.data.version.number,
    });
  } catch (error) {
    console.error("OpenSearch health check failed:", error.message);
    res.status(500).json({
      status: "error",
      message: "Could not connect to OpenSearch",
      error: error.message,
    });
  }
});

// Search Endpoint
app.post("/api/opensearch/search", async (req, res) => {
  try {
    const { query, filters } = req.body;

    // Construct the OpenSearch query
    const fullQuery = {
      size: 20,
      query: {
        bool: {
          must: query
            ? [
                {
                  multi_match: {
                    query,
                    fields: ["eventName.analyzed^3", "category.analyzed^2", "location"], // Use analyzed fields for full-text search
                    type: "best_fields",
                    fuzziness: "AUTO", // Allow fuzzy matching
                  },
                },
              ]
            : [{ match_all: {} }], // Default to match_all if no query is provided
          filter: [
            ...(filters?.priceRange
              ? [
                  {
                    range: {
                      price: {
                        gte: filters.priceRange[0],
                        lte: filters.priceRange[1],
                      },
                    },
                  },
                ]
              : []),
            ...(filters?.categories?.length
              ? [{ terms: { "category.keyword": filters.categories } }]
              : []),
            ...(filters?.locations?.length
              ? [{ terms: { "location.keyword": filters.locations } }]
              : []),
          ],
        },
      },
      aggs: {
        price_ranges: {
          range: {
            field: "price",
            ranges: [
              { to: 500 },
              { from: 500, to: 2000 },
              { from: 2000, to: 4000 },
            ],
          },
        },
        categories: {
          terms: { field: "category.keyword", size: 10 },
        },
        locations: {
          terms: { field: "location.keyword", size: 10 },
        },
      },
    };

    // Send the query to OpenSearch
    const response = await opensearchClient.post("/events/_search", fullQuery);

    // Handle the response and ensure empty buckets are handled gracefully
    res.status(200).json({
      hits: response.data.hits.hits || [],
      aggregations: {
        price_ranges: response.data.aggregations?.price_ranges?.buckets || [],
        categories: response.data.aggregations?.categories?.buckets || [],
        locations: response.data.aggregations?.locations?.buckets || [],
      },
    });
  } catch (error) {
    console.error("Error querying OpenSearch:", error.message);

    // Return a detailed error response
    res.status(500).json({
      message: "Error querying OpenSearch",
      error: error.message,
    });
  }
});

// Facets Endpoint
app.post("/api/opensearch/facets", async (req, res) => {
  try {
    const query = {
      size: 0,
      aggs: {
        price_ranges: {
          range: {
            field: "price",
            ranges: [
              { to: 500 },
              { from: 500, to: 2000 },
              { from: 2000, to: 4000 },
            ],
          },
        },
        categories: {
          terms: { field: "category.keyword", size: 10 },
        },
        locations: {
          terms: { field: "location.keyword", size: 10 },
        },
      },
    };

    const response = await opensearchClient.post("/events/_search", query);

    // Ensure empty buckets are handled
    const aggregations = response.data.aggregations || {};
    res.status(200).json({
      price_ranges: aggregations.price_ranges?.buckets || [],
      categories: aggregations.categories?.buckets || [],
      locations: aggregations.locations?.buckets || [],
    });
  } catch (error) {
    console.error("Error querying OpenSearch facets:", error.message);
    res.status(500).json({
      message: "Error querying OpenSearch facets",
      error: error.message,
    });
  }
});

// Start the Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`OpenSearch URL: ${OPENSEARCH_URL}`);

  // Test OpenSearch connection on startup
  opensearchClient
    .get("/")
    .then((response) => {
      console.log(`Successfully connected to OpenSearch ${response.data.version.number}`);
    })
    .catch((error) => {
      console.error("WARNING: Could not connect to OpenSearch:", error.message);
      console.error("Make sure OpenSearch is running and accessible at:", OPENSEARCH_URL);
    });
});