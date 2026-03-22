// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract CapsulMe is ERC721, Ownable {
    using Strings for uint256;

    // ─── Enums ───────────────────────────────────────────────────────────────
    enum Tier { Pink, Red, Black }
    enum Status { Locked, Unlocked, Opened }

    // ─── Structs ─────────────────────────────────────────────────────────────
    struct Capsule {
        string  encryptedCID;   // IPFS CID of encrypted message
        uint256 unlockTime;     // timestamp when capsule can be opened
        address sender;
        address receiver;
        Tier    tier;
        Status  status;
        string  title;          // public title (not encrypted)
        uint256 lockedValue;    // native ETH locked inside
    }

    // ─── State ───────────────────────────────────────────────────────────────
    uint256 private _tokenIdCounter;

    mapping(uint256 => Capsule) public capsules;
    mapping(address => uint256[]) private _sentCapsules;
    mapping(address => uint256[]) private _receivedCapsules;

    // Tier image CIDs (IPFS) — set by owner after uploading art to IPFS
    // Index: 0 = Pink Tier, 1 = Red Tier, 2 = Black Tier
    string[3] public tierImageCIDs;

    // HTTP IPFS gateway — use Pinata/Cloudflare so images render everywhere (BaseScan, Magic Eden etc)
    string public ipfsGateway = "https://gateway.pinata.cloud/ipfs/";

    // ─── Events ──────────────────────────────────────────────────────────────
    event CapsuleMinted(
        uint256 indexed tokenId,
        address indexed sender,
        address indexed receiver,
        uint256 unlockTime,
        Tier tier,
        uint256 value
    );
    event CapsuleOpened(uint256 indexed tokenId, address indexed opener, uint256 claimedValue);
    event ImageCIDsUpdated(string pinkCID, string redCID, string blackCID);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor() ERC721("CapsulMe", "CAPS") Ownable(msg.sender) {}

    // ─── Set Image CIDs (Owner Only) ─────────────────────────────────────────
    function setImageCIDs(
        string memory _pinkCID,
        string memory _redCID,
        string memory _blackCID
    ) external onlyOwner {
        tierImageCIDs[0] = _pinkCID;
        tierImageCIDs[1] = _redCID;
        tierImageCIDs[2] = _blackCID;
        emit ImageCIDsUpdated(_pinkCID, _redCID, _blackCID);
    }

    // ─── Set IPFS Gateway (Owner Only) ───────────────────────────────────────
    function setIpfsGateway(string memory _gateway) external onlyOwner {
        ipfsGateway = _gateway;
    }

    // ─── Mint: Self Capsule ──────────────────────────────────────────────────
    function mintSelfCapsule(
        string memory _encryptedCID,
        uint256 _unlockTime,
        string memory _title
    ) external payable returns (uint256) {
        require(_unlockTime > block.timestamp, "Unlock time must be in the future");
        return _mintCapsule(_encryptedCID, _unlockTime, msg.sender, _title);
    }

    // ─── Mint: Send Capsule ──────────────────────────────────────────────────
    function mintSendCapsule(
        string memory _encryptedCID,
        uint256 _unlockTime,
        address _receiver,
        string memory _title
    ) external payable returns (uint256) {
        require(_unlockTime > block.timestamp, "Unlock time must be in the future");
        require(_receiver != address(0), "Invalid receiver address");
        return _mintCapsule(_encryptedCID, _unlockTime, _receiver, _title);
    }

    // ─── Internal Mint Logic ─────────────────────────────────────────────────
    function _mintCapsule(
        string memory _encryptedCID,
        uint256 _unlockTime,
        address _receiver,
        string memory _title
    ) internal returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        Tier tier = _computeTier(_unlockTime);

        capsules[tokenId] = Capsule({
            encryptedCID: _encryptedCID,
            unlockTime:   _unlockTime,
            sender:       msg.sender,
            receiver:     _receiver,
            tier:         tier,
            status:       Status.Locked,
            title:        _title,
            lockedValue:  msg.value
        });

        _sentCapsules[msg.sender].push(tokenId);
        _receivedCapsules[_receiver].push(tokenId);

        _safeMint(_receiver, tokenId);

        emit CapsuleMinted(tokenId, msg.sender, _receiver, _unlockTime, tier, msg.value);
        return tokenId;
    }

    // ─── Open Capsule ────────────────────────────────────────────────────────
    function openCapsule(uint256 _tokenId) external {
        require(ownerOf(_tokenId) == msg.sender, "Not the owner");
        require(
            block.timestamp >= capsules[_tokenId].unlockTime,
            "Not yet time to open"
        );
        require(
            capsules[_tokenId].status != Status.Opened,
            "Already opened"
        );

        capsules[_tokenId].status = Status.Opened;
        
        uint256 val = capsules[_tokenId].lockedValue;
        if (val > 0) {
            (bool success, ) = payable(msg.sender).call{value: val}("");
            require(success, "ETH transfer failed");
        }

        emit CapsuleOpened(_tokenId, msg.sender, val);
    }

    // ─── Time Remaining ──────────────────────────────────────────────────────
    function timeRemaining(uint256 _tokenId) external view returns (uint256) {
        uint256 unlock = capsules[_tokenId].unlockTime;
        if (block.timestamp >= unlock) return 0;
        return unlock - block.timestamp;
    }

    // ─── Dashboard Queries ───────────────────────────────────────────────────
    function getSentCapsules(address _user) external view returns (uint256[] memory) {
        return _sentCapsules[_user];
    }

    function getReceivedCapsules(address _user) external view returns (uint256[] memory) {
        return _receivedCapsules[_user];
    }

    // ─── Tier Computation ────────────────────────────────────────────────────
    function _computeTier(uint256 _unlockTime) internal view returns (Tier) {
        uint256 duration = _unlockTime - block.timestamp;
        if (duration < 180 days)  return Tier.Pink;
        if (duration < 730 days)  return Tier.Red;
        return Tier.Black;
    }

    // ─── Dynamic tokenURI ────────────────────────────────────────────────────
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Capsule memory cap = capsules[tokenId];

        string memory statusLabel;
        string memory bgColor;

        if (cap.status == Status.Opened) {
            statusLabel = "Opened";
            bgColor = "#1a1a2e";
        } else if (block.timestamp >= cap.unlockTime) {
            statusLabel = "Ready to Open";
            bgColor = cap.tier == Tier.Pink  ? "#FF5FCF" :
                      cap.tier == Tier.Red   ? "#FF2D55" : "#1a1a1a";
        } else {
            statusLabel = "Locked";
            bgColor = cap.tier == Tier.Pink  ? "#c0628a" :
                      cap.tier == Tier.Red   ? "#8b1a2a" : "#0d0d0d";
        }

        uint8 tierIdx = cap.tier == Tier.Pink ? 0 : cap.tier == Tier.Red ? 1 : 2;
        string memory tierName = cap.tier == Tier.Pink  ? "Pink" :
                                 cap.tier == Tier.Red   ? "Red"  : "Black";

        // Use HTTP IPFS gateway if CID is set, otherwise fallback to inline SVG
        string memory imageURI;
        if (bytes(tierImageCIDs[tierIdx]).length > 0) {
            imageURI = string(abi.encodePacked(ipfsGateway, tierImageCIDs[tierIdx]));
        } else {
            imageURI = _buildInlineSVG(cap.title, statusLabel, bgColor, tierName, tokenId);
        }

        string memory json = string(abi.encodePacked(
            '{"name":"Capsul #', tokenId.toString(), ' - ', _escapeString(cap.title), '",',
            '"description":"A time-locked message capsule on CapsulMe. Unlock: ', cap.unlockTime.toString(), '",',
            '"image":"', imageURI, '",',
            '"attributes":[',
            '{"trait_type":"Status","value":"', statusLabel, '"},',
            '{"trait_type":"Tier","value":"', tierName, '"},',
            '{"trait_type":"Sender","value":"', Strings.toHexString(uint160(cap.sender), 20), '"},',
            '{"trait_type":"Unlock Time","value":', cap.unlockTime.toString(), '},',
            '{"trait_type":"Encrypted CID","value":"', cap.encryptedCID, '"}',
            ']}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    // ─── Inline SVG Fallback ─────────────────────────────────────────────────
    function _buildInlineSVG(
        string memory title,
        string memory statusLabel,
        string memory bgColor,
        string memory tierName,
        uint256 tokenId
    ) internal pure returns (string memory) {
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<rect width="400" height="400" fill="', bgColor, '"/>',
            '<text x="200" y="160" text-anchor="middle" font-size="64" fill="white">&#128228;</text>',
            '<text x="200" y="220" text-anchor="middle" font-family="Arial" font-size="20" fill="white" font-weight="bold">',
            _escapeString(title),
            '</text>',
            '<text x="200" y="255" text-anchor="middle" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.7)">',
            statusLabel,
            '</text>',
            '<text x="200" y="285" text-anchor="middle" font-family="Arial" font-size="12" fill="rgba(255,255,255,0.5)">',
            tierName, ' Tier &bull; #', tokenId.toString(),
            '</text>',
            '</svg>'
        ));
        return string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg))));
    }

    function _escapeString(string memory s) internal pure returns (string memory) {
        return s;
    }
}
