export type RecognitionTarget = 'patrocinio' | 'raccomandazione';

export type SourceReference = {
  readonly sourceId: string;
  readonly article: string;
  /** Printed page numbers, not zero-based PDF indexes. */
  readonly pages: readonly [number, ...number[]];
};

type ItemBase = {
  readonly id: string;
  readonly description: string;
  readonly references: readonly [SourceReference, ...SourceReference[]];
};

// Domain data only: these descriptors are not executable validation predicates.
export type FixedRequirement =
  | {
      readonly type: 'dig-file-format';
      readonly format: 'jpeg';
      readonly extension: '.jpg';
      readonly colorSpace: 'srgb';
    }
  | {
      readonly type: 'digital-long-edge';
      readonly sections: readonly ['DIG', 'IS'];
      readonly pixels: number;
    }
  | {
      readonly type: 'portfolio-composition';
      readonly minImages: number;
      readonly maxImages: number;
      readonly chosenBy: 'author';
    }
  | { readonly type: 'separate-photography-and-synthesis' };

export type ConfigurableParameter =
  | {
      readonly type: 'theme-count';
      readonly section: 'BN' | 'CLP' | 'DIG' | 'PORTFOLIO' | 'IS' | 'all';
      readonly maximum: number;
    }
  | {
      readonly type: 'fiaf-member-discount';
      readonly cases: readonly {
        readonly juryMode: 'in-person' | 'online-or-mixed';
        readonly comparison:
          | 'not-applicable'
          | 'same-section-count-fee-not-increased'
          | 'same-section-count-fee-increased';
        readonly minimumPercent: number;
      }[];
    };

export type RegulatoryItem = ItemBase &
  (
    | {
        readonly kind: 'constraint';
        readonly verification: 'automatic-candidate';
        readonly requirement: FixedRequirement;
      }
    | {
        readonly kind: 'parameter';
        readonly verification: 'automatic-candidate';
        readonly parameter: ConfigurableParameter;
      }
    | { readonly kind: 'recommendation'; readonly verification: 'advisory' }
    | { readonly kind: 'manual'; readonly verification: 'documentary' }
    | {
        readonly kind: 'exception';
        readonly verification: 'documentary';
        readonly relatedItemIds: readonly string[];
        readonly condition: string;
      }
    | {
        readonly kind: 'open-question';
        readonly verification: 'clarification';
        readonly question: string;
      }
  );

export type RegulatorySource = {
  readonly id: string;
  readonly title: string;
  readonly landingPageUrl: string;
  readonly documentUrl: string;
  readonly verifiedOn: string;
};

export type RegulatoryProfile = {
  readonly id: string;
  readonly authority: 'FIAF';
  readonly normativeVersion: string;
  readonly normativeRevision: string;
  readonly implementationVersion: string;
  readonly effectiveFrom: string;
  readonly target: RecognitionTarget;
  readonly sourceIds: readonly string[];
  readonly itemIds: readonly string[];
  readonly status: 'catalog-only';
  readonly disclaimer: string;
};

export type RegulatoryCatalog = {
  readonly sources: readonly RegulatorySource[];
  readonly items: readonly RegulatoryItem[];
  readonly profiles: readonly RegulatoryProfile[];
};
