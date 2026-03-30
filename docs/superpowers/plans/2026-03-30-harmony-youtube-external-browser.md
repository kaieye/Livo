# Harmony YouTube External Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch Harmony YouTube account linking from embedded Web to system browser plus manual in-app confirmation.

**Architecture:** Keep Bilibili on the existing embedded login page, but route YouTube through a small external-navigation service. Use the existing account status storage for manual display-name persistence and extend the settings card with a browser-login hint, a check action, and a manual save form.

**Tech Stack:** ArkTS, ArkUI, Harmony `UIAbilityContext.startAbility`, Preferences-backed account storage, Node test runner.

---
