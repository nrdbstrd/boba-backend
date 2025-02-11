import {
  BoardMetadata,
  LoggedInBoardMetadata,
} from "types/open-api/generated/types";
import { CacheKeys, cache } from "server/cache";
import { DbBoardCategoryDescription, DbBoardTextDescription } from "Types";
import {
  processBoardMetadata,
  processBoardsSummary,
} from "utils/response-utils";

import { BoardByExternalId } from "./sql/types";
import debug from "debug";
import { getBoardByExternalId } from "./queries";
import stringify from "fast-json-stable-stringify";

const info = debug("bobaserver:board:utils-info");
const log = debug("bobaserver:board:utils-log");

/**
 * Returns a delta between the old metadata of a Board and the new one.
 */
export const getMetadataDelta = ({
  oldMetadata,
  newMetadata,
}: {
  oldMetadata: Partial<BoardByExternalId>;
  newMetadata: Partial<BoardByExternalId>;
}): {
  tagline?: string;
  accentColor?: string;
  texts: {
    deleted: { id: string }[];
    newAndUpdated: (DbBoardTextDescription & { updated: boolean })[];
  };
  categoryFilters: {
    deleted: { id: string }[];
    newAndUpdated: {
      id: string;
      index: number;
      title: string;
      type: "text" | "category_filter";
      description: string | null;
      categories: {
        deleted: string[];
        new: string[];
      } | null;
      updated: boolean;
    }[];
  };
} => {
  const oldTexts =
    oldMetadata.descriptions?.filter(
      (desc): desc is DbBoardTextDescription => desc.type == "text"
    ) || [];
  const oldCategoryFilters =
    oldMetadata.descriptions?.filter(
      (desc): desc is DbBoardCategoryDescription =>
        desc.type == "category_filter"
    ) || [];
  const newTexts =
    newMetadata.descriptions?.filter(
      (desc): desc is DbBoardTextDescription => desc.type == "text"
    ) || [];
  const newCategoryFilters =
    newMetadata.descriptions?.filter(
      (desc): desc is DbBoardCategoryDescription =>
        desc.type == "category_filter"
    ) || [];

  // Deleted texts will be in oldTexts but not newTexts
  const deletedTexts = oldTexts.filter(
    (oldText) => !newTexts.some((newText) => newText.id == oldText.id)
  );
  const newAndUpdatedTexts = newTexts.map((text) => ({
    ...text,
    updated: oldTexts.some((oldText) => oldText.id === text.id),
  }));

  // Deleted filters will be in oldCategoryFilters but not newCategoryFilters
  const deletedFilters = oldCategoryFilters.filter(
    (oldFilter) =>
      !newCategoryFilters.some((newFilter) => newFilter.id == oldFilter.id)
  );

  const newAndUpdatedFilters = newCategoryFilters.map((newFilter) => {
    const oldFilter = oldCategoryFilters.find(
      (oldFilter) => oldFilter.id == newFilter.id
    );

    // Deleted categories will be in oldFilter's but not newFilter's.
    // If there's no oldFilter, by definition nothing will have been deleted.
    const deletedCategories = oldFilter
      ? oldFilter.categories.filter(
          (oldCategory) =>
            !newFilter.categories.some(
              (newCategory) =>
                oldCategory.toLowerCase() == newCategory.toLowerCase()
            )
        )
      : [];

    // New categories will be in newFilter's but not oldFilter's.
    // If there's no oldFilter, by definition everything will be new
    const newCategories = oldFilter
      ? newFilter.categories.filter(
          (newCategory) =>
            !oldFilter.categories.some(
              (oldCategory) =>
                oldCategory.toLowerCase() == newCategory.toLowerCase()
            )
        )
      : newFilter.categories;

    return {
      ...newFilter,
      categories: {
        deleted: deletedCategories,
        new: newCategories,
      },
      updated: !!oldFilter,
    };
  });

  return {
    accentColor:
      oldMetadata.settings!.accentColor != newMetadata.settings!.accentColor
        ? newMetadata.settings!.accentColor
        : undefined,
    tagline:
      oldMetadata.tagline != newMetadata.tagline
        ? newMetadata.tagline
        : undefined,
    texts: {
      deleted: deletedTexts.map((text) => ({ id: text.id })),
      newAndUpdated: newAndUpdatedTexts,
    },
    categoryFilters: {
      deleted: deletedFilters.map((filter) => ({ id: filter.id })),
      newAndUpdated: newAndUpdatedFilters,
    },
  };
};

export const getBoardMetadataByExternalId = async ({
  boardExternalId,
  firebaseId,
  hasBoardAccess,
}: {
  boardExternalId: string;
  firebaseId?: string;
  hasBoardAccess: boolean;
}): Promise<BoardMetadata | LoggedInBoardMetadata | null> => {
  if (!firebaseId) {
    const cachedBoard = await cache().hGet(
      CacheKeys.BOARD_METADATA,
      boardExternalId
    );
    if (cachedBoard) {
      log(`Found cached metadata for board ${boardExternalId}`);
      return JSON.parse(cachedBoard);
    }
  }

  const board = await getBoardByExternalId({
    firebaseId,
    boardExternalId,
  });
  info(`Found board`, board);

  if (!board) {
    return null;
  }

  const boardSummary = processBoardsSummary({
    boards: [board],
    isLoggedIn: !!firebaseId,
    hasRealmMemberAccess: hasBoardAccess,
  });
  const boardMetadata = processBoardMetadata({
    metadata: board,
    isLoggedIn: !!firebaseId,
    hasBoardAccess,
  });
  const finalMetadata = {
    ...boardSummary[0],
    ...boardMetadata,
  };
  if (!firebaseId) {
    cache().hSet(
      CacheKeys.BOARD_METADATA,
      boardExternalId,
      stringify(finalMetadata)
    );
  }
  log(`Processed board metadata (${boardExternalId}) for user ${firebaseId}`);
  // @ts-ignore TODO: figure out typings for this whole section
  return finalMetadata;
};
