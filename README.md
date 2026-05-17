# Abuse-Resistant OTP System

A production-grade OTP (One-Time Password) authentication backend built with Node.js and Express. Implements cryptographically secure code generation, bcrypt hashing, brute-force protection, send-rate limiting, and immediate code invalidation — all without using any authentication library.

---

## Table of Contents

1. [Setup & Run](#setup--run)
2. [API Reference](#api-reference)
3. [Security Design](#security-design)
4. [CSPRNG Choice](#csprng-choice)
5. [Hashing Approach](#hashing-approach)
6. [Rate Limit Tracking](#rate-limit-tracking)
7. [Threat Model — What Can Be Recovered From a Leaked OTP Table?](#threat-model)
8. [Running Tests](#running-tests)
9. [Project Structure](#project-structure)

