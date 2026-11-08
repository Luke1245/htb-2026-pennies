# The portrait recommends curated Resources

The Financial portrait now carries Recommendations: read-only personalised pointers to Guides or vetted external Resources, written by Gemini from the portrait and replaced with it. External material is selected from a project-curated registry held alongside `guides.json` and validated by id, not free-formed by Gemini, because hallucinated or dead links on an app for teenagers would destroy the trust the curated Guides were built on (ADRs 0005 and 0006). Personalisation lives in the selection and the reason, not in content discovery.

Considered options: Gemini inventing its own URLs (rejected — unreviewable, link rot, wrong-region risk); a separate recommendation artifact with its own table and lifecycle (rejected — duplicates the privacy surface and sharing-mode enforcement that ADRs 0002, 0003, and 0007 centralised in the portrait).
