import { db } from "@/lib/db";
import { evaluationCriteria } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// ============================================
// Evaluation Criteria Service
// ============================================

interface CriteriaInput {
  name: string;
  description?: string;
  maxPoints: number;
  weight?: number;
  displayOrder?: number;
  isRequired?: boolean;
}

/**
 * Add a criterion to a round.
 */
export async function addCriterion(roundId: string, input: CriteriaInput) {
  const id = crypto.randomUUID();
  await db.insert(evaluationCriteria).values({
    id,
    roundId,
    name: input.name,
    description: input.description || null,
    maxPoints: input.maxPoints,
    weight: String(input.weight ?? 1.0),
    displayOrder: input.displayOrder ?? 0,
    isRequired: input.isRequired ?? true,
  });
  return { id };
}

/**
 * List all criteria for a round, ordered by displayOrder.
 */
export async function getRoundCriteria(roundId: string) {
  return db.query.evaluationCriteria.findMany({
    where: eq(evaluationCriteria.roundId, roundId),
    orderBy: (c, { asc }) => [asc(c.displayOrder)],
  });
}

/**
 * Update a criterion.
 */
export async function updateCriterion(
  criterionId: string,
  input: Partial<CriteriaInput>
) {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.maxPoints !== undefined) updateData.maxPoints = input.maxPoints;
  if (input.weight !== undefined) updateData.weight = String(input.weight);
  if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;
  if (input.isRequired !== undefined) updateData.isRequired = input.isRequired;

  if (Object.keys(updateData).length > 0) {
    await db
      .update(evaluationCriteria)
      .set(updateData)
      .where(eq(evaluationCriteria.id, criterionId));
  }
}

/**
 * Delete a criterion.
 */
export async function deleteCriterion(criterionId: string) {
  await db
    .delete(evaluationCriteria)
    .where(eq(evaluationCriteria.id, criterionId));
}

/**
 * Bulk replace criteria for a round (used by the builder canvas).
 */
export async function bulkSetCriteria(roundId: string, criteria: CriteriaInput[]) {
  // Delete existing
  await db
    .delete(evaluationCriteria)
    .where(eq(evaluationCriteria.roundId, roundId));

  // Insert new
  if (criteria.length > 0) {
    const values = criteria.map((c, idx) => ({
      id: crypto.randomUUID(),
      roundId,
      name: c.name,
      description: c.description || null,
      maxPoints: c.maxPoints,
      weight: String(c.weight ?? 1.0),
      displayOrder: c.displayOrder ?? idx,
      isRequired: c.isRequired ?? true,
    }));

    await db.insert(evaluationCriteria).values(values);
  }
}
