
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "./database";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(new Error("Google account did not provide an email"));
        }

        const name = profile.displayName || email.split("@")[0];
        const avatar = profile.photos?.[0]?.value || null;

        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { googleId: profile.id },
              { email },
            ],
          },
        });

        let user;

        if (existingUser) {
          user = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              googleId: profile.id,
              name,
              email,
              avatar,
            },
          });
        } else {
          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              name,
              email,
              avatar,
            },
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

export default passport;
