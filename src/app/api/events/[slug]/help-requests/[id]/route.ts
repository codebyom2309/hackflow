import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import {
  getHelpRequestById,
  updateHelpRequest,
  addHelpRequestMessage,
} from "@/lib/services/help-request.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string; id: string }> };

/**
 * GET /api/events/[slug]/help-requests/[id]
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const { slug, id } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json(
        { error: "Event not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const ticket = await getHelpRequestById(id);
    if (!ticket) {
      return NextResponse.json(
        { error: "Help request not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: ticket });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/help-requests/[id]");
  }
}

/**
 * PATCH /api/events/[slug]/help-requests/[id]
 * Staff / Organizer claims ticket, changes status, adds resolution notes
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const { slug, id } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json(
        { error: "Event not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Must be COORDINATOR or ORGANIZER
    await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");

    const body = await request.json();
    const { status, priority, claim, resolutionNotes, responseMessage } = body;

    const updates: {
      status?: "SUBMITTED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
      priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
      assignedStaffId?: string | null;
      resolutionNotes?: string | null;
    } = {};

    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (claim === true) {
      updates.assignedStaffId = session.user.id;
      if (!status || status === "SUBMITTED") {
        updates.status = "ASSIGNED";
      }
    }
    if (resolutionNotes !== undefined) updates.resolutionNotes = resolutionNotes;

    const updated = await updateHelpRequest(id, event.id, updates);

    if (responseMessage && typeof responseMessage === "string" && responseMessage.trim()) {
      await addHelpRequestMessage(id, session.user.id, responseMessage.trim(), true);
    }

    return NextResponse.json({
      data: updated,
      message: "Help request updated successfully",
    });
  } catch (error) {
    return handleApiError(error, "PATCH /api/events/[slug]/help-requests/[id]");
  }
}
