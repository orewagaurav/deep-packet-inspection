#ifndef LIVE_CAPTURE_H
#define LIVE_CAPTURE_H

#include <string>
#include <vector>
#include <atomic>
#include <pcap/pcap.h>
#include "pcap_reader.h"   // RawPacket, PcapPacketHeader

namespace PacketAnalyzer {

// ============================================================================
// LiveCapture — Real-time packet capture via libpcap
// ============================================================================
//
// Wraps a libpcap handle to capture packets from a live network interface.
// Produces the same RawPacket struct the rest of the pipeline already uses,
// making it a drop-in replacement for PcapReader in live mode.
//
// Usage:
//   LiveCapture cap("en0");
//   if (!cap.open()) { /* error */ }
//   RawPacket pkt;
//   while (cap.capturePacket(pkt)) { /* process */ }
//   cap.close();
//
// ============================================================================

class LiveCapture {
public:
    // -----------------------------------------------------------------------
    // Constructor
    //   interface : network interface name (e.g. "en0", "eth0")
    //   snaplen   : max bytes to capture per packet (default: 65535)
    // -----------------------------------------------------------------------
    explicit LiveCapture(const std::string& interface, int snaplen = 65535);

    ~LiveCapture();

    // Non-copyable
    LiveCapture(const LiveCapture&) = delete;
    LiveCapture& operator=(const LiveCapture&) = delete;

    // -----------------------------------------------------------------------
    // Open the interface for live capture.
    // Returns false if the interface cannot be opened (check lastError()).
    // -----------------------------------------------------------------------
    bool open();

    // -----------------------------------------------------------------------
    // Read the next packet.
    // Returns true if a packet was read; false on timeout / shutdown / error.
    // The returned RawPacket uses the same layout as PcapReader output.
    // -----------------------------------------------------------------------
    bool capturePacket(RawPacket& pkt);

    // -----------------------------------------------------------------------
    // Close the capture handle and release resources.
    // -----------------------------------------------------------------------
    void close();

    // -----------------------------------------------------------------------
    // Request the capture loop to stop (thread-safe).
    // -----------------------------------------------------------------------
    void requestStop();

    // -----------------------------------------------------------------------
    // Check whether stop has been requested.
    // -----------------------------------------------------------------------
    bool stopRequested() const;

    // -----------------------------------------------------------------------
    // Last error message from libpcap.
    // -----------------------------------------------------------------------
    const std::string& lastError() const { return last_error_; }

    // -----------------------------------------------------------------------
    // Static: list all available network interfaces.
    // Returns a vector of (name, description) pairs.
    // -----------------------------------------------------------------------
    static std::vector<std::pair<std::string, std::string>> listInterfaces();

private:
    std::string interface_;
    int         snaplen_;
    pcap_t*     handle_ = nullptr;
    std::string last_error_;
    std::atomic<bool> stop_flag_{false};
};

} // namespace PacketAnalyzer

#endif // LIVE_CAPTURE_H
