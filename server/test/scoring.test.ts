import { describe, it, expect } from 'vitest';
import {
  rankSuggestions,
  scoreRecipe,
  type CandidateRecipe,
  type SuggestionProfile,
} from '../src/modules/suggestions/scoring';

function profile(overrides: Partial<SuggestionProfile> = {}): SuggestionProfile {
  return {
    diets: [],
    preferredCuisines: [],
    affinity: new Map(),
    ...overrides,
  };
}

function recipe(id: string, tags: CandidateRecipe['tags'] = []): CandidateRecipe {
  return { id, title: 'Recette ' + id, tags };
}

const VEGETARIEN = { id: 'tag-veg', name: 'Végétarien' };
const ITALIENNE = { id: 'tag-ita', name: 'Italienne' };
const DESSERT = { id: 'tag-des', name: 'Dessert' };

describe('Score d une suggestion', () => {
  it('ne donne aucun point à un profil vide', () => {
    const scored = scoreRecipe(recipe('a', [VEGETARIEN, ITALIENNE]), profile());
    expect(scored).toEqual({ id: 'a', score: 0, reasons: [] });
  });

  it('récompense un régime déclaré', () => {
    const scored = scoreRecipe(recipe('a', [VEGETARIEN]), profile({ diets: ['végétarien'] }));
    expect(scored.score).toBe(3);
    expect(scored.reasons).toEqual(['correspond à votre régime : Végétarien']);
  });

  it('récompense une cuisine préférée', () => {
    const scored = scoreRecipe(
      recipe('a', [ITALIENNE]),
      profile({ preferredCuisines: ['italienne'] }),
    );
    expect(scored.score).toBe(2);
    expect(scored.reasons).toEqual(['cuisine que vous appréciez : Italienne']);
  });

  it('ignore la casse et les espaces des libellés du profil', () => {
    const scored = scoreRecipe(recipe('a', [VEGETARIEN]), profile({ diets: ['  VÉGÉTARIEN '] }));
    expect(scored.score).toBe(3);
  });

  it('fait primer le régime quand un libellé figure dans les deux listes', () => {
    // La correspondance se fait sur le libellé, le type des tags n'étant pas
    // fiable : un même mot déclaré des deux côtés compte comme un régime, le
    // signal le plus fort, et une seule fois.
    const scored = scoreRecipe(
      recipe('a', [VEGETARIEN]),
      profile({ diets: ['végétarien'], preferredCuisines: ['végétarien'] }),
    );
    expect(scored.score).toBe(3);
    expect(scored.reasons).toHaveLength(1);
  });

  it('récompense la proximité avec ce que l utilisateur cuisine', () => {
    const scored = scoreRecipe(
      recipe('a', [DESSERT]),
      profile({ affinity: new Map([[DESSERT.id, 2]]) }),
    );
    expect(scored.score).toBe(2);
    expect(scored.reasons).toEqual(['proche de ce que vous cuisinez : Dessert']);
  });

  it('plafonne l affinité d un seul tag', () => {
    // Sans plafond, un tag omniprésent écraserait tous les autres signaux.
    const scored = scoreRecipe(
      recipe('a', [DESSERT]),
      profile({ affinity: new Map([[DESSERT.id, 50]]) }),
    );
    expect(scored.score).toBe(3);
  });

  it('cumule les signaux de plusieurs tags', () => {
    const scored = scoreRecipe(
      recipe('a', [VEGETARIEN, ITALIENNE, DESSERT]),
      profile({
        diets: ['végétarien'],
        preferredCuisines: ['italienne'],
        affinity: new Map([[DESSERT.id, 1]]),
      }),
    );
    expect(scored.score).toBe(6);
    expect(scored.reasons).toHaveLength(3);
  });

  it('ne compte un tag qu une fois : le régime prime sur l affinité', () => {
    const scored = scoreRecipe(
      recipe('a', [VEGETARIEN]),
      profile({ diets: ['végétarien'], affinity: new Map([[VEGETARIEN.id, 3]]) }),
    );
    expect(scored.score).toBe(3);
    expect(scored.reasons).toHaveLength(1);
  });
});

describe('Classement', () => {
  it('range les recettes du meilleur score au moins bon', () => {
    const ranked = rankSuggestions(
      [recipe('faible', [DESSERT]), recipe('fort', [VEGETARIEN, ITALIENNE])],
      profile({
        diets: ['végétarien'],
        preferredCuisines: ['italienne'],
        affinity: new Map([[DESSERT.id, 1]]),
      }),
      10,
    );
    expect(ranked.map((entry) => entry.id)).toEqual(['fort', 'faible']);
  });

  it('conserve l ordre d entrée entre ex aequo', () => {
    // Le vivier arrive du plus récent au plus ancien : à défaut de signal,
    // les dernières recettes ajoutées restent devant.
    const ranked = rankSuggestions(
      [recipe('recent'), recipe('ancien')],
      profile(),
      10,
    );
    expect(ranked.map((entry) => entry.id)).toEqual(['recent', 'ancien']);
  });

  it('respecte la limite demandée', () => {
    const ranked = rankSuggestions([recipe('a'), recipe('b'), recipe('c')], profile(), 2);
    expect(ranked).toHaveLength(2);
  });

  it('rend une liste vide pour un vivier vide', () => {
    expect(rankSuggestions([], profile(), 5)).toEqual([]);
  });
});
