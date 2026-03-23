// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// Custom Errors to save bytecode size
error UnlockTimeInPast();
error InvalidReceiver();
error NeedMoreSigners();
error ThresholdTooLow();
error ThresholdTooHigh();
error InvalidSigner();
error NotPactCapsule();
error CapsuleAlreadyOpened();
error AlreadySigned();
error NotAuthorizedSigner();
error EthTransferFailed();
error UseSignPactInstead();
error NotOwner();
error NotYetTime();

/// @title CapsulMe v2 — Time-Locked + Multi-Sig Pact Capsules
contract CapsulMe is ERC721, Ownable {
    using Strings for uint256;

    // ─── Enums ───────────────────────────────────────────────────────────────
    enum Tier       { Pink, Red, Black }
    enum Status     { Locked, Unlocked, Opened }
    enum CapsuleType { TimeLocked, Pact }

    // ─── Structs ─────────────────────────────────────────────────────────────
    struct Capsule {
        string      encryptedCID;   // IPFS CID of encrypted message
        uint256     unlockTime;     // timestamp when capsule can be opened (0 for Pact)
        address     sender;
        address     receiver;       // NFT owner / initiator for Pact
        Tier        tier;
        Status      status;
        string      title;
        uint256     lockedValue;    // native ETH locked inside
        CapsuleType capsuleType;    // TimeLocked or Pact
        uint256     pactThreshold;  // min signatures needed to unlock (0 if TimeLocked)
        uint256     pactSignCount;  // current signature count
    }

    // ─── State ───────────────────────────────────────────────────────────────
    uint256 private _tokenIdCounter;

    mapping(uint256 => Capsule) public capsules;
    mapping(address => uint256[]) private _sentCapsules;
    mapping(address => uint256[]) private _receivedCapsules;

    // Pact-specific state
    mapping(uint256 => address[]) private _pactSigners;                    // list of valid signers per tokenId
    mapping(uint256 => mapping(address => bool)) public pactSigned;        // who has signed
    mapping(address => uint256[]) private _pactInvites;                    // pact token IDs a user is invited to sign

    // Tier image CIDs (IPFS) — set by owner after uploading art to IPFS
    string[3] public tierImageCIDs;
    string public ipfsGateway = "https://gateway.pinata.cloud/ipfs/";

    // ─── Events ──────────────────────────────────────────────────────────────
    event CapsuleMinted(
        uint256 indexed tokenId,
        address indexed sender,
        address indexed receiver,
        uint256 unlockTime,
        Tier    tier,
        uint256 value
    );
    event PactMinted(
        uint256 indexed tokenId,
        address indexed initiator,
        address[] signers,
        uint256 threshold,
        uint256 value
    );
    event PactSigned(uint256 indexed tokenId, address indexed signer, uint256 signCount, uint256 threshold);
    event CapsuleOpened(uint256 indexed tokenId, address indexed opener, uint256 claimedValue);
    event ImageCIDsUpdated(string pinkCID, string redCID, string blackCID);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor() ERC721("CapsulMe", "CAPS") Ownable(msg.sender) {}

    // ─── Owner: Set Image CIDs ────────────────────────────────────────────────
    function setImageCIDs(string memory _pinkCID, string memory _redCID, string memory _blackCID) external onlyOwner {
        tierImageCIDs[0] = _pinkCID;
        tierImageCIDs[1] = _redCID;
        tierImageCIDs[2] = _blackCID;
        emit ImageCIDsUpdated(_pinkCID, _redCID, _blackCID);
    }

    function setIpfsGateway(string memory _gateway) external onlyOwner {
        ipfsGateway = _gateway;
    }

    // ─── Mint: Self Time-Locked Capsule ──────────────────────────────────────
    function mintSelfCapsule(
        string memory _encryptedCID,
        uint256 _unlockTime,
        string memory _title
    ) external payable returns (uint256) {
        if (_unlockTime <= block.timestamp) revert UnlockTimeInPast();
        return _mintTimeLocked(_encryptedCID, _unlockTime, msg.sender, _title);
    }

    // ─── Mint: Send Time-Locked Capsule ──────────────────────────────────────
    function mintSendCapsule(
        string memory _encryptedCID,
        uint256 _unlockTime,
        address _receiver,
        string memory _title
    ) external payable returns (uint256) {
        if (_unlockTime <= block.timestamp) revert UnlockTimeInPast();
        if (_receiver == address(0)) revert InvalidReceiver();
        return _mintTimeLocked(_encryptedCID, _unlockTime, _receiver, _title);
    }

    // ─── Mint: Pact Capsule ───────────────────────────────────────────────────
    /// @notice Creates a multi-sig pact capsule. Requires `threshold` out of `signers` to approve unlock.
    /// @param _signers  Array of wallet addresses allowed to sign. Must include msg.sender.
    /// @param _threshold Minimum signatures required to unlock (e.g. 3 out of 5).
    function mintPactCapsule(
        string memory _encryptedCID,
        address[] memory _signers,
        uint256 _threshold,
        string memory _title
    ) external payable returns (uint256) {
        if (_signers.length < 2) revert NeedMoreSigners();
        if (_threshold < 2) revert ThresholdTooLow();
        if (_threshold > _signers.length) revert ThresholdTooHigh();

        uint256 tokenId = _tokenIdCounter++;

        capsules[tokenId] = Capsule({
            encryptedCID:   _encryptedCID,
            unlockTime:     0,               // No time lock for Pact
            sender:         msg.sender,
            receiver:       msg.sender,      // initiator holds NFT until unlocked
            tier:           Tier.Black,      // Pact capsules are always Black tier
            status:         Status.Locked,
            title:          _title,
            lockedValue:    msg.value,
            capsuleType:    CapsuleType.Pact,
            pactThreshold:  _threshold,
            pactSignCount:  0
        });

        // Store signers and record invitations
        for (uint256 i = 0; i < _signers.length; i++) {
            if (_signers[i] == address(0)) revert InvalidSigner();
            _pactSigners[tokenId].push(_signers[i]);
            _pactInvites[_signers[i]].push(tokenId);
        }

        _sentCapsules[msg.sender].push(tokenId);
        _receivedCapsules[msg.sender].push(tokenId);

        _safeMint(msg.sender, tokenId);

        emit PactMinted(tokenId, msg.sender, _signers, _threshold, msg.value);
        return tokenId;
    }

    // ─── Sign Pact ────────────────────────────────────────────────────────────
    /// @notice Called by one of the designated signers to cast their vote to unlock the Pact capsule.
    function signPact(uint256 _tokenId) external {
        Capsule storage cap = capsules[_tokenId];

        if (cap.capsuleType != CapsuleType.Pact) revert NotPactCapsule();
        if (cap.status != Status.Locked) revert CapsuleAlreadyOpened();
        if (pactSigned[_tokenId][msg.sender]) revert AlreadySigned();

        // Verify msg.sender is an authorized signer
        bool isAuthorized = false;
        address[] memory signers = _pactSigners[_tokenId];
        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == msg.sender) { isAuthorized = true; break; }
        }
        if (!isAuthorized) revert NotAuthorizedSigner();

        pactSigned[_tokenId][msg.sender] = true;
        cap.pactSignCount++;

        emit PactSigned(_tokenId, msg.sender, cap.pactSignCount, cap.pactThreshold);

        // Auto-unlock if threshold is reached
        if (cap.pactSignCount >= cap.pactThreshold) {
            cap.status = Status.Opened;
            uint256 val = cap.lockedValue;
            if (val > 0) {
                (bool success, ) = payable(ownerOf(_tokenId)).call{value: val}("");
                if (!success) revert EthTransferFailed();
            }
            emit CapsuleOpened(_tokenId, msg.sender, val);
        }
    }

    // ─── Open Time-Locked Capsule ─────────────────────────────────────────────
    function openCapsule(uint256 _tokenId) external {
        Capsule storage cap = capsules[_tokenId];

        if (cap.capsuleType != CapsuleType.TimeLocked) revert UseSignPactInstead();
        if (ownerOf(_tokenId) != msg.sender) revert NotOwner();
        if (block.timestamp < cap.unlockTime) revert NotYetTime();
        if (cap.status == Status.Opened) revert CapsuleAlreadyOpened();

        cap.status = Status.Opened;

        uint256 val = cap.lockedValue;
        if (val > 0) {
            (bool success, ) = payable(msg.sender).call{value: val}("");
            if (!success) revert EthTransferFailed();
        }

        emit CapsuleOpened(_tokenId, msg.sender, val);
    }

    // ─── View Helpers ─────────────────────────────────────────────────────────
    function timeRemaining(uint256 _tokenId) external view returns (uint256) {
        uint256 unlock = capsules[_tokenId].unlockTime;
        if (block.timestamp >= unlock) return 0;
        return unlock - block.timestamp;
    }

    function getSentCapsules(address _user) external view returns (uint256[] memory) {
        return _sentCapsules[_user];
    }

    function getReceivedCapsules(address _user) external view returns (uint256[] memory) {
        return _receivedCapsules[_user];
    }

    function getPactSigners(uint256 _tokenId) external view returns (address[] memory) {
        return _pactSigners[_tokenId];
    }

    function getPactInvites(address _user) external view returns (uint256[] memory) {
        return _pactInvites[_user];
    }

    // ─── Internal Mint: TimeLocked ────────────────────────────────────────────
    function _mintTimeLocked(
        string memory _encryptedCID,
        uint256 _unlockTime,
        address _receiver,
        string memory _title
    ) internal returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        Tier tier = _computeTier(_unlockTime);

        capsules[tokenId] = Capsule({
            encryptedCID:  _encryptedCID,
            unlockTime:    _unlockTime,
            sender:        msg.sender,
            receiver:      _receiver,
            tier:          tier,
            status:        Status.Locked,
            title:         _title,
            lockedValue:   msg.value,
            capsuleType:   CapsuleType.TimeLocked,
            pactThreshold: 0,
            pactSignCount: 0
        });

        _sentCapsules[msg.sender].push(tokenId);
        _receivedCapsules[_receiver].push(tokenId);
        _safeMint(_receiver, tokenId);

        emit CapsuleMinted(tokenId, msg.sender, _receiver, _unlockTime, tier, msg.value);
        return tokenId;
    }

    // ─── Tier Computation ─────────────────────────────────────────────────────
    function _computeTier(uint256 _unlockTime) internal view returns (Tier) {
        uint256 duration = _unlockTime - block.timestamp;
        if (duration < 180 days) return Tier.Pink;
        if (duration < 730 days) return Tier.Red;
        return Tier.Black;
    }

    // ─── Dynamic tokenURI ─────────────────────────────────────────────────────
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Capsule memory cap = capsules[tokenId];

        string memory statusLabel;
        string memory bgColor;

        bool isPact = cap.capsuleType == CapsuleType.Pact;

        if (cap.status == Status.Opened) {
            statusLabel = isPact ? "Pact Executed" : "Opened";
            bgColor = "#1a1a2e";
        } else if (isPact) {
            statusLabel = string(abi.encodePacked(
                "Pact: ", cap.pactSignCount.toString(), "/", cap.pactThreshold.toString(), " Signed"
            ));
            bgColor = "#0d0d0d";
        } else if (block.timestamp >= cap.unlockTime) {
            statusLabel = "Ready to Open";
            bgColor = cap.tier == Tier.Pink ? "#FF5FCF" :
                      cap.tier == Tier.Red  ? "#FF2D55" : "#1a1a1a";
        } else {
            statusLabel = "Locked";
            bgColor = cap.tier == Tier.Pink ? "#c0628a" :
                      cap.tier == Tier.Red  ? "#8b1a2a" : "#0d0d0d";
        }

        uint8 tierIdx = cap.tier == Tier.Pink ? 0 : cap.tier == Tier.Red ? 1 : 2;
        string memory tierName = isPact ? "Pact" :
                                 cap.tier == Tier.Pink  ? "Pink" :
                                 cap.tier == Tier.Red   ? "Red"  : "Black";

        string memory imageURI;
        if (!isPact && bytes(tierImageCIDs[tierIdx]).length > 0) {
            imageURI = string(abi.encodePacked(ipfsGateway, tierImageCIDs[tierIdx]));
        } else {
            imageURI = _buildInlineSVG(cap.title, statusLabel, bgColor, tierName, tokenId);
        }

        string memory json = string(abi.encodePacked(
            '{"name":"Capsul #', tokenId.toString(), ' - ', _escapeString(cap.title), '",',
            '"description":"A ', isPact ? 'multi-sig pact' : 'time-locked', ' capsule.', '",',
            '"image":"', imageURI, '",',
            '"attributes":[',
            '{"trait_type":"Type","value":"',  isPact ? "Pact" : "TimeLocked", '"},',
            '{"trait_type":"Status","value":"', statusLabel, '"},',
            '{"trait_type":"Tier","value":"',   tierName, '"},',
            '{"trait_type":"Sender","value":"', Strings.toHexString(uint160(cap.sender), 20), '"},',
            '{"trait_type":"Encrypted CID","value":"', cap.encryptedCID, '"}',
            ']}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
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
            tierName, ' #', tokenId.toString(),
            '</text>',
            '</svg>'
        ));
        return string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg))));
    }

    function _escapeString(string memory s) internal pure returns (string memory) {
        return s;
    }
}
