cmake_minimum_required(VERSION 3.16)
project(PacketAnalyzer VERSION 3.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Source files
set(SOURCES
    src/main.cpp
    src/pcap_reader.cpp
    src/packet_parser.cpp
)

set(DPI_ENGINE_SOURCES
    src/dpi_mt.cpp
    src/pcap_reader.cpp
    src/packet_parser.cpp
    src/sni_extractor.cpp
    src/types.cpp
    src/live_capture.cpp
    src/log_shipper.cpp
    src/threat_detector.cpp
    src/rule_sync.cpp
)

# Header files location
include_directories(${CMAKE_SOURCE_DIR}/include)

# Create the executables
add_executable(packet_analyzer ${SOURCES})
add_executable(dpi_engine ${DPI_ENGINE_SOURCES})

# ---------------------------------------------------------------------------
# Find and link libpcap
# ---------------------------------------------------------------------------
find_library(PCAP_LIBRARY pcap)
if(NOT PCAP_LIBRARY)
    message(FATAL_ERROR "libpcap not found. On macOS it is included with Xcode Command Line Tools.")
endif()
message(STATUS "Found libpcap: ${PCAP_LIBRARY}")

# ---------------------------------------------------------------------------
# Find and link libcurl
# ---------------------------------------------------------------------------
find_package(CURL REQUIRED)
if(NOT CURL_FOUND)
    message(FATAL_ERROR "libcurl not found. On macOS it ships with the system.")
endif()
message(STATUS "Found libcurl: ${CURL_LIBRARIES}")

# ---------------------------------------------------------------------------
# Link libraries to dpi_engine
# ---------------------------------------------------------------------------
target_link_libraries(dpi_engine PRIVATE ${PCAP_LIBRARY} CURL::libcurl)

# For macOS, we might need to link against system libraries later
if(APPLE)
    # Add any macOS-specific settings here
endif()
