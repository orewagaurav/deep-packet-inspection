#include "live_capture.h"
#include <iostream>
#include <cstring>

namespace PacketAnalyzer {

// ============================================================================
// Constructor / Destructor
// ============================================================================

LiveCapture::LiveCapture(const std::string& interface, int snaplen)
    : interface_(interface), snaplen_(snaplen) {}

LiveCapture::~LiveCapture() {
    close();
}

// ============================================================================
// open() — pcap_open_live with promiscuous mode
// ============================================================================

bool LiveCapture::open() {
    close();  // ensure any previous handle is released

    char errbuf[PCAP_ERRBUF_SIZE];

    // Promiscuous mode = 1  |  Read timeout = 1000 ms
    // The 1-second timeout lets us check stop_flag_ periodically
    handle_ = pcap_open_live(
        interface_.c_str(),
        snaplen_,
        1,          // promiscuous
        1000,       // read timeout (ms)
        errbuf
    );

    if (!handle_) {
        last_error_ = std::string(errbuf);
        std::cerr << "[LiveCapture] Failed to open " << interface_
                  << ": " << last_error_ << "\n";
        return false;
    }

    // Verify Ethernet link layer (DLT_EN10MB = 1)
    int linktype = pcap_datalink(handle_);
    if (linktype != DLT_EN10MB) {
        last_error_ = "Unsupported link-layer type " + std::to_string(linktype)
                    + " (only Ethernet/DLT_EN10MB is supported)";
        std::cerr << "[LiveCapture] " << last_error_ << "\n";
        pcap_close(handle_);
        handle_ = nullptr;
        return false;
    }

    std::cout << "[LiveCapture] Capturing on interface: " << interface_
              << "  (snaplen=" << snaplen_ << ", promisc=ON)\n";
    return true;
}

// ============================================================================
// capturePacket() — read one packet into a RawPacket
// ============================================================================

bool LiveCapture::capturePacket(RawPacket& pkt) {
    if (!handle_ || stop_flag_.load(std::memory_order_relaxed)) {
        return false;
    }

    struct pcap_pkthdr* hdr = nullptr;
    const u_char*       data = nullptr;

    // pcap_next_ex returns:
    //   1  = packet read OK
    //   0  = timeout expired (no packet yet)
    //  -1  = error
    //  -2  = break from loop (pcap_breakloop)
    int rc = pcap_next_ex(handle_, &hdr, &data);

    if (rc == 0) {
        // Timeout — no packet available. Not an error.
        return false;
    }
    if (rc < 0) {
        if (rc == -2 || stop_flag_.load(std::memory_order_relaxed)) {
            return false;  // normal shutdown
        }
        last_error_ = pcap_geterr(handle_);
        std::cerr << "[LiveCapture] pcap_next_ex error: " << last_error_ << "\n";
        return false;
    }

    // ---- Fill our existing RawPacket struct (same layout as PcapReader) ----
    pkt.header.ts_sec   = static_cast<uint32_t>(hdr->ts.tv_sec);
    pkt.header.ts_usec  = static_cast<uint32_t>(hdr->ts.tv_usec);
    pkt.header.incl_len = hdr->caplen;
    pkt.header.orig_len = hdr->len;

    pkt.data.assign(data, data + hdr->caplen);

    return true;
}

// ============================================================================
// close() — release pcap handle
// ============================================================================

void LiveCapture::close() {
    if (handle_) {
        pcap_close(handle_);
        handle_ = nullptr;
        std::cout << "[LiveCapture] Capture handle closed.\n";
    }
}

// ============================================================================
// requestStop() / stopRequested()
// ============================================================================

void LiveCapture::requestStop() {
    stop_flag_.store(true, std::memory_order_release);
    if (handle_) {
        pcap_breakloop(handle_);
    }
}

bool LiveCapture::stopRequested() const {
    return stop_flag_.load(std::memory_order_acquire);
}

// ============================================================================
// listInterfaces() — enumerate all available network interfaces
// ============================================================================

std::vector<std::pair<std::string, std::string>> LiveCapture::listInterfaces() {
    std::vector<std::pair<std::string, std::string>> result;
    char errbuf[PCAP_ERRBUF_SIZE];
    pcap_if_t* alldevs = nullptr;

    if (pcap_findalldevs(&alldevs, errbuf) == -1) {
        std::cerr << "[LiveCapture] pcap_findalldevs failed: " << errbuf << "\n";
        return result;
    }

    for (pcap_if_t* d = alldevs; d != nullptr; d = d->next) {
        std::string name = d->name ? d->name : "";
        std::string desc = d->description ? d->description : "(no description)";
        result.emplace_back(name, desc);
    }

    pcap_freealldevs(alldevs);
    return result;
}

} // namespace PacketAnalyzer
