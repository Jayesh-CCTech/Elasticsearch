import React, { useState, useEffect } from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faFilter, faMapMarkerAlt, faTags } from "@fortawesome/free-solid-svg-icons";
import { Checkbox } from "../components/ui/checkbox";
import { Slider } from "../components/ui/slider";
import { Badge } from "../components/ui/badge";
import { XCircle } from "lucide-react";

// Define the type for Elasticsearch results
interface EventResult {
  _id: string;
  _source: {
    eventName: string;
    category: string;
    location: string;
    price: number;
  };
}

interface FacetBucket {
  key: string | number;
  doc_count: number;
}

interface FacetAggregations {
  price_ranges: { buckets: FacetBucket[] };
  categories: { buckets: FacetBucket[] };
  locations: { buckets: FacetBucket[] };
}

interface FilterState {
  priceRange: [number, number];
  categories: string[];
  locations: string[];
  searchQuery: string;
}

const EventSearch = () => {
  const [results, setResults] = useState<EventResult[]>([]);
  const [facets, setFacets] = useState<FacetAggregations | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 5000],
    categories: [],
    locations: [],
    searchQuery: "",
  });
  const [activeFilters, setActiveFilters] = useState<any[]>([]);

  const fetchFacets = async () => {
    try {
      const response = await axios.post("http://localhost:3001/api/opensearch/facets");
      setFacets(response.data);
    } catch (error) {
      console.error("Error fetching facets:", error);
    }
  };

  const fetchResults = async () => {
    try {
      const response = await axios.post("http://localhost:3001/api/opensearch/search", {
        query: filters.searchQuery, // Ensure this is being sent correctly
        filters,
      });
      setResults(response.data.hits);
    } catch (error) {
      console.error("Error fetching search results:", error);
    }
  };

  useEffect(() => {
    fetchFacets();
    fetchResults();
  }, []);

  useEffect(() => {
    fetchResults();
    updateActiveFilters();
  }, [filters]);

  const updateActiveFilters = () => {
    const newActiveFilters = [];

    if (filters.searchQuery) {
      newActiveFilters.push({ type: "search", label: `"${filters.searchQuery}"` });
    }

    filters.categories.forEach((category) =>
      newActiveFilters.push({ type: "category", label: category })
    );

    filters.locations.forEach((location) =>
      newActiveFilters.push({ type: "location", label: location })
    );

    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 5000) {
      newActiveFilters.push({
        type: "price",
        label: `$${filters.priceRange[0]} - $${filters.priceRange[1]}`,
      });
    }

    setActiveFilters(newActiveFilters);
  };

  const handleFilterChange = (type: string, value: string | [number, number], checked?: boolean) => {
    setFilters((prevFilters) => {
      switch (type) {
        case "category":
          return {
            ...prevFilters,
            categories: checked
              ? [...prevFilters.categories, value as string]
              : prevFilters.categories.filter((c) => c !== value),
          };
        case "location":
          return {
            ...prevFilters,
            locations: checked
              ? [...prevFilters.locations, value as string]
              : prevFilters.locations.filter((l) => l !== value),
          };
        case "price":
          return { ...prevFilters, priceRange: value as [number, number] };
        case "search":
          return { ...prevFilters, searchQuery: value as string };
        default:
          return prevFilters;
      }
    });
  };

  const removeFilter = (type: string, value: string) => {
    handleFilterChange(type, value, false);
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
        Event Search
      </h1>
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <div className="w-full lg:w-1/4 bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700">
            <FontAwesomeIcon icon={faFilter} className="text-blue-500 mr-2" />
            Filters
          </h2>

          {/* Search Input */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4 text-gray-600">
              <FontAwesomeIcon icon={faSearch} className="text-blue-500 mr-2" />
              Search
            </h3>
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              placeholder="Search events..."
              className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Price Range */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4 text-gray-600">
              <FontAwesomeIcon icon={faTags} className="text-blue-500 mr-2" />
              Price Range
            </h3>
            <Slider
              defaultValue={[0, 5000]}
              value={filters.priceRange}
              min={0}
              max={5000}
              step={100}
              onValueChange={(value) => handleFilterChange("price", value)}
            />
            <div className="flex justify-between text-xs mt-2">
              <span>$0</span>
              <span>$5000</span>
            </div>
          </div>

          {/* Categories */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4 text-gray-600">
              <FontAwesomeIcon icon={faTags} className="text-blue-500 mr-2" />
              Categories
            </h3>
            {facets?.categories?.buckets?.length > 0 ? (
              facets.categories.buckets.map((bucket) => (
                <div key={bucket.key} className="flex items-center mb-2">
                  <Checkbox
                    id={`category-${bucket.key}`}
                    onCheckedChange={(checked) =>
                      handleFilterChange("category", bucket.key.toString(), checked === true)
                    }
                  />
                  <label htmlFor={`category-${bucket.key}`} className="ml-2 text-sm">
                    {bucket.key} ({bucket.doc_count})
                  </label>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No categories available</p>
            )}
          </div>

          {/* Locations */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4 text-gray-600">
              <FontAwesomeIcon icon={faMapMarkerAlt} className="text-blue-500 mr-2" />
              Locations
            </h3>
            {facets?.locations?.buckets?.length > 0 ? (
              facets.locations.buckets.map((bucket) => (
                <div key={bucket.key} className="flex items-center mb-2">
                  <Checkbox
                    id={`location-${bucket.key}`}
                    onCheckedChange={(checked) =>
                      handleFilterChange("location", bucket.key.toString(), checked === true)
                    }
                  />
                  <label htmlFor={`location-${bucket.key}`} className="ml-2 text-sm">
                    {bucket.key} ({bucket.doc_count})
                  </label>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No locations available</p>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="mb-6">
            <h1 className="text-3xl font-medium text-gray-700">
              Results <span className="text-sm text-gray-500">({results.length})</span>
            </h1>
            <p className="text-gray-600 mt-2">
              Use the filters on the left to refine your search.
            </p>
          </div>

          {/* Active Filters */}
          <div className="mb-6">
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <Badge key={filter.label} variant="outline" className="px-2 py-1 flex items-center gap-1">
                    {filter.label}
                    <XCircle
                      className="h-4 w-4 ml-1 cursor-pointer"
                      onClick={() => removeFilter(filter.type, filter.label)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          <div>
            {results.length > 0 ? (
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((result) => (
                  <li
                    key={result._id}
                    className="p-4 border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition"
                  >
                    <h3 className="text-lg font-semibold mb-2 text-gray-800">
                      {result._source.eventName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      <FontAwesomeIcon icon={faTags} className="text-blue-500 mr-1" />
                      Category: {result._source.category}
                    </p>
                    <p className="text-sm text-gray-600">
                      <FontAwesomeIcon icon={faMapMarkerAlt} className="text-blue-500 mr-1" />
                      Location: {result._source.location}
                    </p>
                    <p className="text-sm text-gray-600">
                      <FontAwesomeIcon icon={faTags} className="text-blue-500 mr-1" />
                      Price: ${result._source.price}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-gray-500">No results found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventSearch;