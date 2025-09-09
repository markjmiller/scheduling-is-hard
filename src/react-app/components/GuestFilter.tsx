import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";

interface GuestInfo {
  id: string;
  name?: string;
  isHost?: boolean;
  hasResponded?: boolean;
}

// Memoized guest item component to prevent unnecessary re-renders
const GuestItem = memo(
  ({
    guest,
    displayName,
    isSelected,
    onToggle,
    activeUserId,
  }: {
    guest: GuestInfo;
    displayName: string;
    isSelected: boolean;
    onToggle: (guestId: string) => void;
    activeUserId?: string;
  }) => {
    return (
      <label className="guest-item">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(guest.id)}
        />
        <div className="filter-guest-info">
          <span className="filter-guest-name">
            {displayName}
            {!guest.name && <span className="filter-guest-id"> (ID)</span>}
            {guest.isHost && (
              <i className="fas fa-user host-available-icon"></i>
            )}
            {activeUserId && guest.id === activeUserId && (
              <i className="fas fa-star active-user-star"></i>
            )}
          </span>
          {guest.hasResponded && (
            <span className="responded-badge">
              <i className="fas fa-check-circle"></i>
            </span>
          )}
        </div>
      </label>
    );
  },
);

interface GuestFilterProps {
  guests: GuestInfo[];
  selectedGuestIds: string[];
  onGuestSelectionChange: (selectedIds: string[]) => void;
  activeUserId?: string; // ID of the current user (host on HostPage, guest on GuestPage)
}

export default function GuestFilter({
  guests,
  selectedGuestIds,
  onGuestSelectionChange,
  activeUserId,
}: GuestFilterProps) {
  const [showGuestFilter, setShowGuestFilter] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowGuestFilter(false);
      }
    };

    if (showGuestFilter) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showGuestFilter]);

  // Stabilize guest objects to prevent unnecessary re-renders
  const stableGuests = useMemo(() => {
    return guests.map((guest) => ({
      id: guest.id,
      name: guest.name || "",
      isHost: Boolean(guest.isHost),
      hasResponded: Boolean(guest.hasResponded),
    }));
  }, [
    guests
      .map((g) => `${g.id}-${g.name || ""}-${g.isHost}-${g.hasResponded}`)
      .join(","),
  ]);

  // Guest filter helper functions with stabilized objects
  const sortedGuests = useMemo(() => {
    return [...stableGuests].sort((a, b) => {
      // New sorting hierarchy: host first, active user second, then alphabetically
      const aIsHost = a.isHost;
      const bIsHost = b.isHost;
      const aIsActiveUser = activeUserId && a.id === activeUserId;
      const bIsActiveUser = activeUserId && b.id === activeUserId;

      // Host always comes first
      if (aIsHost && !bIsHost) return -1;
      if (!aIsHost && bIsHost) return 1;

      // If neither or both are host, check for active user
      if (aIsActiveUser && !bIsActiveUser) return -1;
      if (!aIsActiveUser && bIsActiveUser) return 1;

      // If same priority level, sort alphabetically by name
      const nameA = a.name || a.id.substring(0, 8);
      const nameB = b.name || b.id.substring(0, 8);
      return nameA.localeCompare(nameB);
    });
  }, [stableGuests, activeUserId]);

  const filteredGuests = useMemo(() => {
    return sortedGuests.filter((guest) => {
      const displayName = guest.name || guest.id.substring(0, 8);
      return displayName.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [sortedGuests, searchTerm]);

  const handleGuestToggle = useCallback(
    (guestId: string) => {
      const isSelected = selectedGuestIds.includes(guestId);
      let newSelection: string[];
      if (isSelected) {
        newSelection = selectedGuestIds.filter((id) => id !== guestId);
      } else {
        newSelection = [...selectedGuestIds, guestId];
      }
      onGuestSelectionChange(newSelection);
    },
    [selectedGuestIds, onGuestSelectionChange],
  );

  const handleSelectAll = useCallback(() => {
    const allFilteredIds = filteredGuests.map((g) => g.id);
    const newSelection = [...new Set([...selectedGuestIds, ...allFilteredIds])];
    onGuestSelectionChange(newSelection);
  }, [filteredGuests, selectedGuestIds, onGuestSelectionChange]);

  const handleSelectNone = useCallback(() => {
    const filteredIds = new Set(filteredGuests.map((g) => g.id));
    const newSelection = selectedGuestIds.filter((id) => !filteredIds.has(id));
    onGuestSelectionChange(newSelection);
  }, [filteredGuests, selectedGuestIds, onGuestSelectionChange]);

  // Don't render if no guests
  if (guests.length === 0) {
    return null;
  }

  // Check if guests are filtered (not all selected)
  const selectedCount = selectedGuestIds.length;
  const totalGuestCount = guests.length;
  const isFiltered = selectedCount < totalGuestCount;

  return (
    <div className="guest-filter-section" ref={dropdownRef}>
      <button
        className="filter-btn"
        onClick={() => setShowGuestFilter(!showGuestFilter)}
        title="Filter guests in heatmap"
      >
        <i className="fas fa-filter"></i>
        Filter
        {isFiltered && <span className="filter-indicator"></span>}
      </button>

      {showGuestFilter && (
        <div className="filter-dropdown">
          <div className="filter-header">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="bulk-actions">
              <button
                className="bulk-btn select-all"
                onClick={handleSelectAll}
                disabled={filteredGuests.length === 0}
              >
                <i className="fas fa-check-square"></i>
                All
              </button>
              <button
                className="bulk-btn select-none"
                onClick={handleSelectNone}
                disabled={filteredGuests.length === 0}
              >
                <i className="fas fa-square"></i>
                None
              </button>
            </div>
          </div>

          <div className="guest-list">
            {filteredGuests.length === 0 ? (
              <div className="no-results">
                <i className="fas fa-user-slash"></i>
                No guests found
              </div>
            ) : (
              filteredGuests.map((guest) => {
                const displayName = guest.name || guest.id.substring(0, 8);
                const isSelected = selectedGuestIds.includes(guest.id);
                return (
                  <GuestItem
                    key={guest.id}
                    guest={guest}
                    displayName={displayName}
                    isSelected={isSelected}
                    onToggle={handleGuestToggle}
                    activeUserId={activeUserId}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
